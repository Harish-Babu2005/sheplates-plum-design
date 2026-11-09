import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { confirmPaidOrder } from "@/lib/payment-confirm";

/**
 * Razorpay webhook. Set it in the Razorpay dashboard to POST here for: payment.captured, order.paid, payment.failed, refund.processed,
 * with the secret in RAZORPAY_WEBHOOK_SECRET. It makes payments reliable: an order is confirmed even when the customer closes the
 * page after paying, and the same event delivered twice changes nothing (Razorpay retries until it gets a 200).
 * The signature is checked on the exact bytes received; anything unsigned or wrongly signed is refused.
 */
function validSignature(raw: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type RzpEvent = { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; error_description?: string } }; order?: { entity?: { id?: string; amount_paid?: number } }; refund?: { entity?: { id?: string; payment_id?: string; amount?: number } } } };

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  if (!signature || !validSignature(raw, signature, secret)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let event: RzpEvent;
  try { event = JSON.parse(raw) as RzpEvent; } catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const payment = event.payload?.payment?.entity;

  try {
    if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.id && payment.order_id) {
      const result = await confirmPaidOrder(admin, { razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id, amountPaise: Number(payment.amount || 0), currency: payment.currency });
      if (!result.ok) {
        // An amount that does not match is never confirmed. Answer 200 for a payment we do not know (it is not ours to retry) and 422 for a mismatch so it is noticed.
        console.error("[razorpay webhook] not confirmed:", result.reason, result.detail || "");
        return NextResponse.json({ ok: false, reason: result.reason }, { status: result.reason === "amount_mismatch" ? 422 : 200 });
      }
      return NextResponse.json({ ok: true, alreadyPaid: result.alreadyPaid });
    }
    if (event.event === "payment.failed" && payment?.order_id) {
      await admin.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("provider_reference", payment.order_id).eq("status", "pending");
      return NextResponse.json({ ok: true });
    }
    if (event.event === "refund.processed" && event.payload?.refund?.entity?.payment_id) {
      await admin.from("audit_logs").insert({ action: "razorpay_refund_processed", entity_type: "payment", entity_id: String(event.payload.refund.entity.payment_id), after_data: { refundId: event.payload.refund.entity.id, amountPaise: event.payload.refund.entity.amount } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true, ignored: event.event || "unknown" });
  } catch (error) {
    console.error("[razorpay webhook] failed:", error);
    return NextResponse.json({ error: "Could not process the event." }, { status: 500 }); // Razorpay will retry
  }
}
