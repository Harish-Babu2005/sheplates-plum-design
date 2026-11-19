import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !service) {
    return NextResponse.json({ exists: false });
  }

  let body: { email?: string; role?: string };
  try {
    body = (await request.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return NextResponse.json({ exists: false });
    }

    const existingUser = listData.users.find((u) => u.email?.toLowerCase() === email);
    if (!existingUser) {
      return NextResponse.json({ exists: false });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", existingUser.id)
      .maybeSingle();

    const role = profile?.role || existingUser.user_metadata?.role || "customer";

    return NextResponse.json({
      exists: true,
      role,
      error: "This email is already registered. Please sign in instead.",
    });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
