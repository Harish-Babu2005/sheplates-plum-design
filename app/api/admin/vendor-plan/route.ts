import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlanLimits } from "@/lib/plans";
import { PLAN_INCLUDED_CREDITS } from "@/lib/ai-credits-config";

type VendorPlanBody = {
  vendorId?: string;
  planCode?: "taster" | "crave" | "thrive" | "crown";
  reason?: string;
};

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  taster: "Taster",
  crave: "Crave",
  thrive: "Thrive",
  crown: "Crown",
  basic: "Basic",
  growth: "Growth",
  premium: "Premium",
};

const PLAN_PRICES: Record<string, number> = {
  taster: 499,
  crave: 699,
  thrive: 799,
  crown: 999,
  basic: 499,
  growth: 699,
  premium: 999,
};

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const body = (await request.json().catch(() => ({}))) as VendorPlanBody;
  const vendorId = body.vendorId?.trim();
  const planCode = body.planCode?.trim().toLowerCase() as "taster" | "crave" | "thrive" | "crown";
  const reason = body.reason?.trim() || "Vendor plan updated by admin";

  if (!vendorId) {
    return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });
  }
  if (!planCode || !["taster", "crave", "thrive", "crown"].includes(planCode)) {
    return NextResponse.json({ error: "Valid plan code is required (taster, crave, thrive, crown)." }, { status: 400 });
  }

  // Fallback for mock/demo environment without Supabase keys
  if (!url || !anonKey || !serviceRoleKey) {
    const prevPlan = "Crave";
    const newPlan = PLAN_DISPLAY_NAMES[planCode] || planCode;
    const prevPrice = PLAN_PRICES.crave;
    const newPrice = PLAN_PRICES[planCode] || 699;

    return NextResponse.json({
      ok: true,
      updated: true,
      audit: {
        action: "Vendor Plan Updated",
        actor: "Admin · Super Admin",
        actorName: "Admin",
        actorRole: "Super Admin",
        vendorId,
        vendorName: "Demo Vendor",
        previousPlan: prevPlan,
        newPlan,
        previousPrice: `₹${prevPrice}/month`,
        newPrice: `₹${newPrice}/month`,
        at: new Date().toISOString(),
      },
    });
  }

  // 1. Authenticate caller
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in as Operations or Super Admin to update vendor plans." }, { status: 401 });
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { data: callerProfile, error: profileError } = await caller
    .from("profiles")
    .select("full_name, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !callerProfile || !["operations", "admin"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Only Operations or Super Admin can update vendor plans." }, { status: 403 });
  }

  const actorRoleDisplay = callerProfile.role === "admin" ? "Super Admin" : "Operations";
  const actorName = callerProfile.full_name || authData.user.user_metadata?.full_name || "Staff Member";
  const actorEmail = authData.user.email || "";

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Fetch target vendor
  const { data: vendor, error: vendorErr } = await admin
    .from("vendors")
    .select("id, name, business_name, plan_id, operational_status, verification_status, billing_status, created_at")
    .eq("id", vendorId)
    .maybeSingle();

  if (vendorErr || !vendor) {
    return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  }

  const vendorName = vendor.business_name || vendor.name || "Vendor";

  // 3. Fetch current plan details
  let oldPlanRecord: { id: string; code: string; name: string; monthly_price: number } | null = null;
  if (vendor.plan_id) {
    const { data: pData } = await admin
      .from("vendor_plans")
      .select("id, code, name, monthly_price")
      .eq("id", vendor.plan_id)
      .maybeSingle();
    oldPlanRecord = pData;
  }

  // 4. Fetch target plan details
  const { data: newPlanRecord, error: newPlanErr } = await admin
    .from("vendor_plans")
    .select("id, code, name, monthly_price, active")
    .eq("code", planCode)
    .maybeSingle();

  if (newPlanErr || !newPlanRecord || !newPlanRecord.active) {
    return NextResponse.json({ error: `Target plan ${planCode} is not available.` }, { status: 400 });
  }

  // 5. Prevent duplicate audit entries if plan is already the same (Requirement 7)
  if (oldPlanRecord && oldPlanRecord.id === newPlanRecord.id) {
    return NextResponse.json({
      ok: true,
      updated: false,
      message: "Vendor is already assigned to this plan.",
      plan: newPlanRecord.name,
    });
  }

  const oldPlanCode = oldPlanRecord?.code || "taster";
  const oldPlanName = oldPlanRecord?.name || PLAN_DISPLAY_NAMES[oldPlanCode] || "Taster";
  const oldPrice = Number(oldPlanRecord?.monthly_price ?? PLAN_PRICES[oldPlanCode] ?? 499);
  const oldStatus = vendor.operational_status || "Active";

  const newPlanName = newPlanRecord.name || PLAN_DISPLAY_NAMES[planCode] || "Crown";
  const newPrice = Number(newPlanRecord.monthly_price ?? PLAN_PRICES[planCode] ?? 999);
  const newStatus = vendor.operational_status || "Active";

  // 6. Update vendor plan in database
  const { error: updateErr } = await admin
    .from("vendors")
    .update({
      plan_id: newPlanRecord.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message || "Failed to update vendor plan." }, { status: 500 });
  }

  // 7. Enforce downgrade limits (products, staff, delivery slots)
  const limits = getPlanLimits(planCode);

  try {
    const { data: activeProducts } = await admin
      .from("vendor_menu_items")
      .select("id, created_at")
      .eq("vendor_id", vendorId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (activeProducts && activeProducts.length > limits.maxProducts) {
      const excess = activeProducts.slice(0, activeProducts.length - limits.maxProducts);
      const excessIds = excess.map((p) => p.id);
      await admin.from("vendor_menu_items").update({ active: false, updated_at: new Date().toISOString() }).in("id", excessIds);
    }

    const { data: activeStaff } = await admin
      .from("vendor_delivery_staff")
      .select("id, created_at")
      .eq("vendor_id", vendorId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (activeStaff && activeStaff.length > limits.maxDeliveryStaff) {
      const excess = activeStaff.slice(0, activeStaff.length - limits.maxDeliveryStaff);
      const excessIds = excess.map((s) => s.id);
      await admin.from("vendor_delivery_staff").update({ active: false, updated_at: new Date().toISOString() }).in("id", excessIds);
    }

    const { data: activeSlots } = await admin
      .from("vendor_delivery_slots")
      .select("id, created_at")
      .eq("vendor_id", vendorId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (activeSlots && activeSlots.length > limits.maxDeliverySlots) {
      const excess = activeSlots.slice(0, activeSlots.length - limits.maxDeliverySlots);
      const excessIds = excess.map((s) => s.id);
      await admin.from("vendor_delivery_slots").update({ is_active: false, updated_at: new Date().toISOString() }).in("id", excessIds);
    }
  } catch (limErr) {
    console.warn("Limit enforcement non-critical failure:", limErr);
  }

  // 8. Update AI credits allowance
  try {
    const includedCredits = PLAN_INCLUDED_CREDITS[planCode] ?? 0;
    const { data: currentCreds } = await admin
      .from("vendor_ai_credits")
      .select("purchased_credits")
      .eq("vendor_id", vendorId)
      .maybeSingle();

    const purchased = currentCreds?.purchased_credits ?? 0;
    await admin.from("vendor_ai_credits").upsert({
      vendor_id: vendorId,
      plan_credits: includedCredits,
      purchased_credits: purchased,
      updated_at: new Date().toISOString(),
    }, { onConflict: "vendor_id" });

    await admin.from("vendor_ai_credit_ledger").insert({
      vendor_id: vendorId,
      entry_type: "grant",
      action: "plan_change_grant",
      credits_change: includedCredits,
      plan_credits_after: includedCredits,
      purchased_credits_after: purchased,
      balance_after: includedCredits + purchased,
      notes: `Updated to ${newPlanName} plan (${includedCredits} plan credits)`,
      actor_id: authData.user.id,
    });
  } catch (credErr) {
    console.warn("AI credit sync non-critical failure:", credErr);
  }

  // 9. Record Audit Log entry ONLY after successful update (Requirement 5)
  const beforeData = {
    plan: oldPlanCode,
    planName: oldPlanName,
    monthlyPrice: oldPrice,
    formattedPrice: `₹${oldPrice}/month`,
    status: oldStatus,
    vendorName,
    vendorId,
  };

  const afterData = {
    plan: planCode,
    planName: newPlanName,
    monthlyPrice: newPrice,
    formattedPrice: `₹${newPrice}/month`,
    status: newStatus,
    vendorName,
    vendorId,
    actorName,
    actorEmail,
    actorRole: actorRoleDisplay,
    changedAt: new Date().toISOString(),
    reason,
  };

  const { data: auditRecord, error: auditErr } = await admin
    .from("audit_logs")
    .insert({
      actor_id: authData.user.id,
      actor_role: callerProfile.role,
      action: "Vendor Plan Updated",
      entity_type: "vendor",
      entity_id: vendorId,
      before_data: beforeData,
      after_data: afterData,
    })
    .select("id, created_at")
    .single();

  if (auditErr) {
    console.error("Failed to insert audit log:", auditErr);
  }

  return NextResponse.json({
    ok: true,
    updated: true,
    auditId: auditRecord?.id,
    vendorId,
    vendorName,
    previousPlan: oldPlanName,
    newPlan: newPlanName,
    previousPrice: `₹${oldPrice}/month`,
    newPrice: `₹${newPrice}/month`,
    actorName,
    actorRole: actorRoleDisplay,
    changedAt: auditRecord?.created_at || new Date().toISOString(),
  });
}
