import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmail } from "@/lib/email/outbox";
import { insertOrderWithBilling, priceExistingSchedule } from "@/lib/schedule-billing";

/**
 * Confirms a paid order: marks the payment paid, confirms the order, starts its schedule (creating the remaining delivery
 * orders) and notifies the vendor and the customer. It is used by the Razorpay webhook, so an order is confirmed even if the
 * customer closed the page before the browser could report the payment. It is idempotent: calling it again for an order that
 * is already paid does nothing, and it never creates a second delivery order for the same date.
 */
function orderNumber() { return `SP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
function addDays(dateISO: string, days: number) { const date = new Date(`${dateISO}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function scheduleDates(schedule: { start_date: string; end_date?: string | null; recurrence: string; weekdays?: number[] | null }) {
  const start = String(schedule.start_date);
  const mode = String(schedule.recurrence || "once");
  if (mode === "once") return [start];
  const defaultHorizon = mode === "daily" ? 29 : 27;
  const end = schedule.end_date ? String(schedule.end_date) : addDays(start, defaultHorizon);
  const out: string[] = [];
  for (let cursor = start, guard = 0; cursor <= end && guard < 366; cursor = addDays(cursor, 1), guard++) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    if (mode === "daily" || (mode === "weekly" && day === new Date(`${start}T12:00:00Z`).getUTCDay()) || (mode === "custom" && (schedule.weekdays || []).includes(day))) out.push(cursor);
  }
  return out.length ? out : [start];
}

export type ConfirmResult = { ok: true; alreadyPaid: boolean; orderId: string } | { ok: false; reason: "payment_not_found" | "order_not_found" | "cancelled" | "amount_mismatch"; detail?: string };

export async function confirmPaidOrder(admin: SupabaseClient, input: { razorpayOrderId: string; razorpayPaymentId: string; amountPaise: number; currency?: string }): Promise<ConfirmResult> {
  const found = await admin.from("payments").select("id,order_id,customer_id,amount,status,provider_reference").eq("provider_reference", input.razorpayOrderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const payment = found.data as { id: string; order_id: string; customer_id: string; amount: number; status: string } | null;
  if (!payment) return { ok: false, reason: "payment_not_found", detail: input.razorpayOrderId };
  if (payment.status === "paid") return { ok: true, alreadyPaid: true, orderId: payment.order_id };

  if ((input.currency || "INR").toUpperCase() !== "INR") return { ok: false, reason: "amount_mismatch", detail: `currency ${input.currency}` };
  const expectedPaise = Math.round(Number(payment.amount) * 100);
  if (expectedPaise !== Math.round(input.amountPaise)) return { ok: false, reason: "amount_mismatch", detail: `expected ${expectedPaise}, got ${input.amountPaise}` };

  const orderResult = await admin.from("orders").select("id,order_number,schedule_id,customer_id,vendor_id,customer_total,scheduled_date,scheduled_slot,fulfilment_mode,vendor_base_total,markup_total,tax_amount,delivery_fee,status,product_schedules(start_date,end_date,recurrence,weekdays),order_items(product_name,quantity,unit,vendor_base_price,markup_percent,customer_price)").eq("id", payment.order_id).maybeSingle();
  const order = orderResult.data as Record<string, unknown> | null;
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status === "cancelled") return { ok: false, reason: "cancelled" };

  // Only one caller wins: the update only matches a payment that is not yet paid.
  const marked = await admin.from("payments").update({ status: "paid", provider: "razorpay", provider_reference: input.razorpayPaymentId, updated_at: new Date().toISOString() }).eq("id", payment.id).neq("status", "paid").select("id");
  if (marked.error) throw marked.error;
  if (!marked.data?.length) return { ok: true, alreadyPaid: true, orderId: payment.order_id };

  const orderId = String(order.id);
  const orderUpdate = await admin.from("orders").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", orderId);
  if (orderUpdate.error) throw orderUpdate.error;

  const rawSchedule = (Array.isArray(order.product_schedules) ? order.product_schedules[0] : order.product_schedules) as { start_date: string; end_date?: string | null; recurrence: string; weekdays?: number[] | null } | null;
  if (order.schedule_id) await admin.from("product_schedules").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", String(order.schedule_id)).eq("status", "awaiting_payment");
  if (rawSchedule && order.schedule_id) {
    const firstItem = (Array.isArray(order.order_items) ? order.order_items[0] : order.order_items) as Record<string, unknown> | undefined;
    const remaining = scheduleDates(rawSchedule).filter((d) => d !== String(order.scheduled_date));
    const pricedLater = await priceExistingSchedule(admin, String(order.schedule_id), remaining); // product price, GST and delivery per delivery; plans per day
    for (const date of remaining) {
      const day = pricedLater?.deliveries.find((d) => d.date === date);
      if (pricedLater && !day) continue; // the chef is not cooking that day
      const duplicate = await admin.from("orders").select("id").eq("schedule_id", String(order.schedule_id)).eq("scheduled_date", date).maybeSingle();
      if (duplicate.data?.id) continue;
      const orderRow = { order_number: orderNumber(), schedule_id: order.schedule_id, customer_id: order.customer_id, vendor_id: order.vendor_id, fulfilment_mode: order.fulfilment_mode, scheduled_date: date, scheduled_slot: order.scheduled_slot, status: "confirmed" };
      const created = day
        ? await insertOrderWithBilling(admin, orderRow, day)
        : await admin.from("orders").insert({ ...orderRow, vendor_base_total: Number(order.vendor_base_total || 0), markup_total: Number(order.markup_total || 0), tax_amount: Number(order.tax_amount || 0), delivery_fee: Number(order.delivery_fee || 0), customer_total: Number(order.customer_total || 0) }).select("id,order_number").single();
      if (created.error) throw created.error;
      if (firstItem) await admin.from("order_items").insert({ order_id: created.data.id, product_name: day?.label || String(firstItem.product_name || "Scheduled item"), quantity: Number(firstItem.quantity || 1), unit: String(firstItem.unit || "pack"), vendor_base_price: day ? day.baseUnit : Number(firstItem.vendor_base_price || 0), markup_percent: day && pricedLater ? pricedLater.markupPercent : Number(firstItem.markup_percent || 0), customer_price: day ? day.customerUnit : Number(firstItem.customer_price || 0) });
      await admin.from("payments").insert({ order_id: created.data.id, customer_id: payment.customer_id, amount: 0, status: "paid", provider: "schedule_prepaid", provider_reference: `COVERED-${orderId}` });
    }
  }

  const vendor = await admin.from("vendors").select("owner_id,name").eq("id", String(order.vendor_id)).maybeSingle();
  const vendorRow = vendor.data as { owner_id?: string; name?: string } | null;
  const owner = vendorRow?.owner_id;
  if (owner) await admin.from("notifications").insert({ recipient_id: owner, kind: "new_order", title: "New paid order", body: `${order.order_number} is confirmed for ${order.scheduled_date}.`, entity_type: "order", entity_id: orderId });
  await admin.from("notifications").insert({ recipient_id: payment.customer_id, kind: "payment", title: "Payment confirmed", body: `${order.order_number} is confirmed and sent to the vendor.`, entity_type: "order", entity_id: orderId });
  await admin.from("communication_outbox").update({ status: "cancelled" }).eq("recipient_id", payment.customer_id).eq("template_key", "payment_reminder").contains("payload", { orderId }).eq("status", "queued");
  await sendOrderEmails(admin, { order, orderId, customerId: payment.customer_id, ownerId: owner, vendorName: vendorRow?.name });
  return { ok: true, alreadyPaid: false, orderId };
}

/** Best effort: a mail problem must never undo a confirmed, paid order. The dedupe key stops a repeat webhook sending twice. */
async function sendOrderEmails(admin: SupabaseClient, input: { order: Record<string, unknown>; orderId: string; customerId: string; ownerId?: string; vendorName?: string }) {
  try {
    const { order, orderId } = input;
    const emailOf = async (userId?: string) => (userId ? (await admin.auth.admin.getUserById(userId)).data.user?.email : undefined);
    const [customerEmail, vendorEmail, profile] = await Promise.all([emailOf(input.customerId), emailOf(input.ownerId), admin.from("profiles").select("full_name").eq("id", input.customerId).maybeSingle()]);
    const items = (Array.isArray(order.order_items) ? order.order_items : []) as Array<{ product_name?: string; quantity?: number; customer_price?: number }>;
    const subtotal = items.reduce((sum, i) => sum + Number(i.customer_price || 0) * Number(i.quantity || 1), 0);
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.sheplates.com";
    const common = { orderNumber: order.order_number, date: order.scheduled_date, slot: order.scheduled_slot, mode: order.fulfilment_mode };
    if (customerEmail) await enqueueEmail(admin, { to: customerEmail, template: "order_confirmed", dedupeKey: `order_confirmed:${orderId}`, data: { ...common, customerName: (profile.data as { full_name?: string } | null)?.full_name, vendorName: input.vendorName, items: items.map((i) => ({ name: i.product_name, quantity: i.quantity, price: i.customer_price })), subtotal, deliveryFee: order.delivery_fee, gstAmount: order.tax_amount, total: order.customer_total, link: `${base}/customer/orders` } });
    if (vendorEmail) await enqueueEmail(admin, { to: vendorEmail, template: "vendor_new_order", dedupeKey: `vendor_new_order:${orderId}`, data: { ...common, subtotal, deliveryFee: order.delivery_fee, link: `${base}/vendor/orders` } });
  } catch (error) { console.error("order email skipped", (error as Error).message); }
}
