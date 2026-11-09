import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MIN_DELIVERY_FEE } from "@/lib/billing";

/**
 * Operations and Super Admin set a vendor's commercial terms: commission %, GST mode and delivery fee. Vendors never can.
 * GET  ?vendorId=...   returns the current values.
 * POST { vendorId, commissionPercent?, gstMode?, deliveryFeeOverride? }   null clears a value so the default applies.
 */
type Caller = { id: string; role: string };

async function staffCaller(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { error: NextResponse.json({ error: "Commercial terms are not available in this deployment." }, { status: 503 }) } as const;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "Sign in as Operations or Super Admin." }, { status: 401 }) } as const;
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await caller.auth.getUser(token);
  if (!data.user) return { error: NextResponse.json({ error: "Unauthorised." }, { status: 401 }) } as const;
  const { data: profile } = await caller.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile || !["operations", "admin"].includes(String(profile.role))) return { error: NextResponse.json({ error: "Only Operations or Super Admin can change commercial terms." }, { status: 403 }) } as const;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { admin, user: { id: data.user.id, role: String(profile.role) } as Caller } as const;
}

export async function GET(request: Request) {
  const ctx = await staffCaller(request);
  if ("error" in ctx) return ctx.error;
  const vendorId = new URL(request.url).searchParams.get("vendorId") || "";
  if (!vendorId) return NextResponse.json({ error: "vendorId is required." }, { status: 400 });
  const vendor = await ctx.admin.from("vendors").select("id,category,gst_mode,delivery_fee_override").eq("id", vendorId).maybeSingle();
  const terms = await ctx.admin.from("vendor_commercial_terms").select("commission_percent").eq("vendor_id", vendorId).maybeSingle();
  return NextResponse.json({
    vendorId, category: (vendor.data as { category?: string } | null)?.category ?? null,
    gstMode: (vendor.data as { gst_mode?: string } | null)?.gst_mode ?? null,
    deliveryFeeOverride: (vendor.data as { delivery_fee_override?: number } | null)?.delivery_fee_override ?? null,
    commissionPercent: (terms.data as { commission_percent?: number } | null)?.commission_percent ?? null,
    migrationApplied: !vendor.error && !terms.error,
  });
}

export async function POST(request: Request) {
  const ctx = await staffCaller(request);
  if ("error" in ctx) return ctx.error;
  let body: { vendorId?: string; commissionPercent?: number | null; gstMode?: string | null; deliveryFeeOverride?: number | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const vendorId = String(body.vendorId || "");
  if (!vendorId) return NextResponse.json({ error: "vendorId is required." }, { status: 400 });

  const has = (k: keyof typeof body) => Object.prototype.hasOwnProperty.call(body, k);
  const vendorPatch: Record<string, unknown> = {};
  let commission: number | null | undefined;
  if (has("commissionPercent")) {
    if (body.commissionPercent === null) commission = null;
    else {
      const n = Number(body.commissionPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: "Commission must be between 0 and 100 percent." }, { status: 400 });
      commission = Math.round(n * 100) / 100;
    }
  }
  if (has("gstMode")) {
    if (body.gstMode !== null && !["none", "vendor", "platform"].includes(String(body.gstMode))) return NextResponse.json({ error: "GST mode must be none, vendor or platform." }, { status: 400 });
    vendorPatch.gst_mode = body.gstMode;
  }
  if (has("deliveryFeeOverride")) {
    if (body.deliveryFeeOverride === null) vendorPatch.delivery_fee_override = null;
    else {
      const n = Number(body.deliveryFeeOverride);
      if (!Number.isFinite(n) || n < MIN_DELIVERY_FEE || n > 1000) return NextResponse.json({ error: `The delivery fee must be between ₹${MIN_DELIVERY_FEE} and ₹1000.` }, { status: 400 });
      vendorPatch.delivery_fee_override = Math.round(n * 100) / 100;
    }
  }
  if (!has("commissionPercent") && !Object.keys(vendorPatch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const exists = await ctx.admin.from("vendors").select("id").eq("id", vendorId).maybeSingle();
  if (!exists.data) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  if (Object.keys(vendorPatch).length) {
    const updated = await ctx.admin.from("vendors").update(vendorPatch).eq("id", vendorId);
    if (updated.error) return NextResponse.json({ error: /gst_mode|delivery_fee_override|schema cache/i.test(updated.error.message) ? "Run the V9_22 database update first (supabase/V9_22_COMMERCIAL_TERMS.sql)." : updated.error.message }, { status: 500 });
  }
  if (commission !== undefined) {
    const saved = await ctx.admin.from("vendor_commercial_terms").upsert({ vendor_id: vendorId, commission_percent: commission, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "vendor_id" });
    if (saved.error) return NextResponse.json({ error: /vendor_commercial_terms|schema cache/i.test(saved.error.message) ? "Run the V9_22 database update first (supabase/V9_22_COMMERCIAL_TERMS.sql)." : saved.error.message }, { status: 500 });
  }
  await ctx.admin.from("audit_logs").insert({ actor_id: ctx.user.id, actor_role: ctx.user.role, action: "set_vendor_commercial_terms", entity_type: "vendor", entity_id: vendorId, after_data: { commission, ...vendorPatch } });
  return NextResponse.json({ ok: true });
}
