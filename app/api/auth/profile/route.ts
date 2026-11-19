import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return null;

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { caller, admin, token };
}

export async function POST(request: Request) {
  const c = getClients(request);
  if (!c) {
    return NextResponse.json({ error: "Authentication credentials required." }, { status: 401 });
  }

  const { data: authData, error: authError } = await c.caller.auth.getUser(c.token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid or expired session. Please sign in again." }, { status: 401 });
  }

  const user = authData.user;
  let body: { preferredRole?: "customer" | "vendor"; name?: string; mode?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {}

  const preferredRole = body.preferredRole;
  const userMeta = user.user_metadata || {};
  const metaName = (body.name?.trim() || userMeta.full_name || userMeta.name || user.email?.split("@")[0] || "User") as string;

  // Retrieve existing profile
  const { data: profile } = await c.admin
    .from("profiles")
    .select("id, full_name, role, vendor_id, tours_completed, created_at")
    .eq("id", user.id)
    .maybeSingle();

  // Determine target role: preferredRole from entry portal or role in user_metadata
  const effectiveRole = preferredRole || (userMeta.role === "vendor" ? "vendor" : undefined);

  if (!profile) {
    const targetRole = effectiveRole || "customer";
    const { data: createdProfile, error: createError } = await c.admin
      .from("profiles")
      .upsert({ id: user.id, full_name: metaName, role: targetRole }, { onConflict: "id" })
      .select("id, full_name, role, vendor_id, tours_completed")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (userMeta.role !== targetRole) {
      await c.admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...userMeta, full_name: metaName, role: targetRole },
      });
    }

    return NextResponse.json({
      profile: createdProfile,
      isNewVendor: targetRole === "vendor",
    });
  }

  // Profile already exists:
  // If user signed up/in via Vendor portal or user_metadata says vendor, ensure role is vendor
  if (effectiveRole === "vendor" && profile.role !== "vendor") {
    const { data: updatedProfile, error: updateError } = await c.admin
      .from("profiles")
      .update({ role: "vendor", full_name: metaName })
      .eq("id", user.id)
      .select("id, full_name, role, vendor_id, tours_completed")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await c.admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...userMeta, full_name: metaName, role: "vendor" },
    });

    return NextResponse.json({
      profile: updatedProfile,
      isNewVendor: true,
    });
  }

  // Ensure full_name is populated if missing
  if (!profile.full_name && metaName) {
    await c.admin.from("profiles").update({ full_name: metaName }).eq("id", user.id);
    profile.full_name = metaName;
  }

  // For vendor profiles, ensure vendor_id is linked if they own a vendor record
  let vendorId = profile.vendor_id;
  if (!vendorId && profile.role === "vendor") {
    const { data: ownedVendor } = await c.admin
      .from("vendors")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (ownedVendor?.id) {
      vendorId = ownedVendor.id;
      await c.admin.from("profiles").update({ vendor_id: vendorId }).eq("id", user.id);
      profile.vendor_id = vendorId;
    }
  }

  return NextResponse.json({
    profile: {
      ...profile,
      vendor_id: vendorId,
    },
    isNewVendor: profile.role === "vendor" && !vendorId,
  });
}
