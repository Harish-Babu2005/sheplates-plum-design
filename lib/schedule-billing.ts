import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateBillingSummary, type BillingSummary } from "./billing.ts";
import { loadCustomerCoords, loadVendorBillingTerms } from "./billing-server.ts";
import { loadPlanContext, priceDeliveries } from "./menu-pricing.ts";
import { withMarkup } from "./weekly-menu.ts";

/**
 * Server-side price of a subscription (schedule). Every delivery is billed exactly like a cart order: product price (a home-food
 * plan has its own price per weekday), plus its GST, plus its delivery fee, with commission and the invoice type worked out the
 * same way. The subscription total is the sum of the deliveries, and it is what the customer pays once, up front.
 */
export type Delivery = { date: string; label: string | null; baseUnit: number; customerUnit: number; baseTotal: number; billing: BillingSummary };
export type SchedulePrice = { deliveries: Delivery[]; skipped: string[]; total: number; markupPercent: number; isPlan: boolean; withinRadius: boolean; warning?: string };

const money2 = (n: number) => Math.round(n * 100) / 100;

export async function priceSchedule(admin: SupabaseClient, input: {
  customerId: string; vendorId: string; menuItem: { id: string; name: string; vendor_base_price: number }; quantity: number; fulfilmentMode: string; dates: string[];
  coords?: { latitude?: unknown; longitude?: unknown };
}): Promise<SchedulePrice> {
  const base = Math.max(0, Number(input.menuItem.vendor_base_price || 0));
  const quantity = Math.max(0.001, Number(input.quantity || 1));
  const markup = await admin.from("vendor_item_markups").select("markup_percent").eq("menu_item_id", input.menuItem.id).maybeSingle();
  const markupPercent = Math.max(0, Number((markup.data as { markup_percent?: number } | null)?.markup_percent || 0));
  const plan = await loadPlanContext(admin, input.vendorId, input.menuItem.name, base);
  const lines: { date: string; label: string | null; baseUnit: number; customerUnit: number }[] = [];
  let skipped: string[] = [];
  if (plan) {
    const priced = priceDeliveries(input.dates, plan, input.menuItem.name, markupPercent);
    skipped = priced.skipped;
    for (const d of priced.days) lines.push({ date: d.date, label: d.label, baseUnit: d.baseUnit, customerUnit: d.customerUnit });
  } else {
    for (const date of input.dates) lines.push({ date, label: null, baseUnit: base, customerUnit: withMarkup(base, markupPercent) });
  }
  const terms = await loadVendorBillingTerms(admin, input.vendorId);
  const customerCoords = await loadCustomerCoords(admin, input.customerId, input.coords);
  const deliveries: Delivery[] = lines.map((l) => ({
    date: l.date, label: l.label, baseUnit: l.baseUnit, customerUnit: l.customerUnit, baseTotal: money2(l.baseUnit * quantity),
    billing: calculateBillingSummary({
      items: [{ name: l.label || input.menuItem.name, price: l.customerUnit, quantity }],
      mode: input.fulfilmentMode, customerCoords, vendorCoords: { latitude: terms.latitude, longitude: terms.longitude }, serviceRadiusKm: terms.radiusKm,
      vendorCustomFee: terms.deliveryFeeOverride, gstMode: terms.gstMode, vendorCategory: terms.category, vendorPlan: terms.plan, commissionPercentOverride: terms.commissionPercent,
    }),
  }));
  const first = deliveries[0]?.billing;
  return { deliveries, skipped, total: money2(deliveries.reduce((sum, d) => sum + d.billing.totalAmount, 0)), markupPercent, isPlan: Boolean(plan), withinRadius: first ? first.isWithinRadius : true, warning: first?.warningMessage };
}

/** Same, for a schedule that already exists (used when paying, and when creating the later deliveries). */
export async function priceExistingSchedule(admin: SupabaseClient, scheduleId: string, dates: string[]): Promise<SchedulePrice | null> {
  const schedule = await admin.from("product_schedules").select("menu_item_id,customer_id,vendor_id,quantity,fulfilment_mode").eq("id", scheduleId).maybeSingle();
  const s = schedule.data as { menu_item_id?: string; customer_id?: string; vendor_id?: string; quantity?: number; fulfilment_mode?: string } | null;
  if (!s?.menu_item_id || !s.customer_id || !s.vendor_id) return null;
  const item = await admin.from("vendor_menu_items").select("id,name,vendor_base_price").eq("id", s.menu_item_id).maybeSingle();
  const m = item.data as { id: string; name: string; vendor_base_price: number } | null;
  if (!m) return null;
  return priceSchedule(admin, { customerId: s.customer_id, vendorId: s.vendor_id, menuItem: m, quantity: Number(s.quantity || 1), fulfilmentMode: s.fulfilment_mode || "vendor_delivery", dates });
}

/** The order columns for one delivery. The detailed breakdown columns are only written when the database has them (V9_22). */
export function orderTotals(d: Delivery) {
  const b = d.billing;
  return {
    base: { vendor_base_total: d.baseTotal, markup_total: money2(Math.max(0, b.subtotal - d.baseTotal)), tax_amount: b.gstAmount, delivery_fee: b.deliveryFee, customer_total: b.totalAmount },
    breakdown: { subtotal: b.subtotal, gst_amount: b.gstAmount, gst_rate: b.gstRate, discount_amount: b.discountAmount, total_amount: b.totalAmount, currency: b.currency, delivery_distance: b.deliveryDistanceKm, commission_percent: b.commissionPercent, commission_amount: b.commissionAmount, vendor_payout: b.vendorPayout, invoice_type: b.invoiceType, gst_mode: b.gstMode },
  };
}
export const missingColumn = (e: { code?: string; message?: string } | null | undefined) => Boolean(e && (e.code === "42703" || e.code === "PGRST204" || /column .* (does not exist|of relation)|schema cache/i.test(e.message || "")));

export async function insertOrderWithBilling(admin: SupabaseClient, row: Record<string, unknown>, d: Delivery) {
  const t = orderTotals(d);
  let result = await admin.from("orders").insert({ ...row, ...t.base, ...t.breakdown }).select("id,order_number").single();
  if (result.error && missingColumn(result.error)) result = await admin.from("orders").insert({ ...row, ...t.base }).select("id,order_number").single();
  return result;
}
export async function updateOrderWithBilling(admin: SupabaseClient, orderId: string, d: Delivery) {
  const t = orderTotals(d), now = new Date().toISOString();
  const result = await admin.from("orders").update({ ...t.base, ...t.breakdown, updated_at: now }).eq("id", orderId);
  if (result.error && missingColumn(result.error)) return admin.from("orders").update({ ...t.base, updated_at: now }).eq("id", orderId);
  return result;
}
