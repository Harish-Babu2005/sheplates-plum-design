import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGstMode, type GstMode } from "./billing.ts";

/** Server-only: the vendor facts the bill depends on, read with the service role. Tolerates a database that does not have the V9_22 columns yet. */
export type VendorBillingTerms = {
  category?: string;
  plan?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
  gstMode: GstMode;
  deliveryFeeOverride?: number | null;
  commissionPercent?: number | null;
};

const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export async function loadVendorBillingTerms(admin: SupabaseClient, vendorId: string): Promise<VendorBillingTerms> {
  let row: Record<string, unknown> | null = null;
  const full = await admin.from("vendors").select("id,category,latitude,longitude,service_radius_km,plan_id,gst_mode,delivery_fee_override").eq("id", vendorId).maybeSingle();
  if (!full.error) row = full.data as Record<string, unknown> | null;
  else {
    const base = await admin.from("vendors").select("id,category,latitude,longitude,service_radius_km,plan_id").eq("id", vendorId).maybeSingle();
    row = (base.data as Record<string, unknown> | null) ?? null;
  }
  let plan: string | undefined;
  if (row?.plan_id) {
    const p = await admin.from("vendor_plans").select("code").eq("id", String(row.plan_id)).maybeSingle();
    plan = (p.data as { code?: string } | null)?.code;
  }
  let commissionPercent: number | null = null;
  try {
    const c = await admin.from("vendor_commercial_terms").select("commission_percent").eq("vendor_id", vendorId).maybeSingle();
    if (!c.error) commissionPercent = num((c.data as { commission_percent?: unknown } | null)?.commission_percent);
  } catch { /* table not created yet */ }
  const category = row?.category ? String(row.category) : undefined;
  return {
    category, plan, latitude: num(row?.latitude), longitude: num(row?.longitude), radiusKm: num(row?.service_radius_km),
    gstMode: normalizeGstMode(row?.gst_mode, category), deliveryFeeOverride: num(row?.delivery_fee_override), commissionPercent,
  };
}

/** The delivery pin: coordinates sent with the request win; otherwise the customer's saved location. */
export async function loadCustomerCoords(admin: SupabaseClient, customerId: string, sent?: { latitude?: unknown; longitude?: unknown }) {
  const sentLat = num(sent?.latitude), sentLng = num(sent?.longitude);
  if (sentLat !== null && sentLng !== null) return { latitude: sentLat, longitude: sentLng };
  const pref = await admin.from("customer_preferences").select("latitude,longitude").eq("customer_id", customerId).maybeSingle();
  return { latitude: num((pref.data as { latitude?: unknown } | null)?.latitude), longitude: num((pref.data as { longitude?: unknown } | null)?.longitude) };
}
