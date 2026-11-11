import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || (!anon && !service)) {
    return NextResponse.json({ error: "Branding service is unavailable." }, { status: 503 });
  }

  const client = createClient(url, service || anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId");

  let query = client.from("vendors").select("id,name,category,logo_url,banner_url,description");
  if (vendorId) {
    query = query.eq("id", vendorId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    brandings: (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      logo_url: row.logo_url || null,
      banner_url: row.banner_url || null,
      description: row.description || null,
    })),
  });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return NextResponse.json({ error: "Branding storage service is unavailable." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in to update vendor branding." }, { status: 401 });
  }

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: authData } = await caller.auth.getUser(token);
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const { data: profile } = await caller
    .from("profiles")
    .select("role,vendor_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile || !["vendor", "operations", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Vendor, Operations, or Super Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    vendorId?: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
  };

  const vendorId = body.vendorId?.trim();
  if (!vendorId) {
    return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });
  }

  if (profile.role === "vendor") {
    const isLinked = profile.vendor_id && profile.vendor_id === vendorId;
    if (!isLinked) {
      const { data: ownVendor } = await caller
        .from("vendors")
        .select("id")
        .eq("id", vendorId)
        .eq("owner_id", authData.user.id)
        .maybeSingle();
      if (!ownVendor) {
        return NextResponse.json({ error: "You are not authorized to edit this store's branding." }, { status: 403 });
      }
    }
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.logoUrl !== undefined) patch.logo_url = body.logoUrl;
  if (body.bannerUrl !== undefined) patch.banner_url = body.bannerUrl;
  if (body.bio !== undefined) patch.description = body.bio;

  let updateRes = await admin.from("vendors").update(patch).eq("id", vendorId);

  // If banner_url column doesn't exist yet, retry updating logo_url only
  if (updateRes.error && (updateRes.error.code === "42703" || /banner_url/i.test(updateRes.error.message || ""))) {
    const fallbackPatch: Record<string, unknown> = { updated_at: patch.updated_at };
    if (patch.logo_url !== undefined) fallbackPatch.logo_url = patch.logo_url;
    if (patch.description !== undefined) fallbackPatch.description = patch.description;
    updateRes = await admin.from("vendors").update(fallbackPatch).eq("id", vendorId);
  }

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    vendorId,
    logoUrl: body.logoUrl,
    bannerUrl: body.bannerUrl,
  });
}

