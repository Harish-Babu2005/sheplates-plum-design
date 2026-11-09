import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Who is calling a signing endpoint, and the service-role client the server uses to read and write the evidence. */
export async function signContext(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { error: NextResponse.json({ error: "Online signing is not available in this deployment." }, { status: 503 }) } as const;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "Please sign in first." }, { status: 401 }) } as const;
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await caller.auth.getUser(token);
  if (!data.user) return { error: NextResponse.json({ error: "Please sign in again." }, { status: 401 }) } as const;
  const { data: profile } = await caller.from("profiles").select("role,full_name").eq("id", data.user.id).maybeSingle();
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { admin, user: data.user, role: String((profile as { role?: string } | null)?.role || ""), profileName: (profile as { full_name?: string } | null)?.full_name || "" } as const;
}

export async function ownVendor(admin: SupabaseClient, vendorId: string, userId: string) {
  const { data } = await admin.from("vendors").select("id,name,owner_id").eq("id", vendorId).maybeSingle();
  const v = data as { id: string; name: string; owner_id: string } | null;
  return v && v.owner_id === userId ? v : null;
}
export const isStaff = (role: string) => ["operations", "admin"].includes(role);
export const clientIp = (r: Request) => (r.headers.get("x-forwarded-for") || "").split(",")[0].trim() || r.headers.get("x-real-ip") || "";
