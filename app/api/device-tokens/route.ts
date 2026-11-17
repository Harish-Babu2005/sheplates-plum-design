import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const authHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  // If Supabase is not configured (demo/mock mode), acknowledge safely
  if (!url || !anon || !service) {
    return NextResponse.json({
      success: true,
      mode: "demo",
      message: "Device notification token accepted in demo environment.",
    });
  }

  const caller = createClient(url, anon, {
    global: { headers: authHeader ? { Authorization: `Bearer ${authHeader}` } : {} },
    auth: { persistSession: false },
  });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  let userId: string | null = null;
  if (authHeader) {
    const { data: authData } = await caller.auth.getUser(authHeader);
    userId = authData?.user?.id || null;
  }

  const body = (await request.json().catch(() => ({}))) || {};
  const action = body.action || "register";
  const endpoint = body.endpoint || body.token || "";
  const p256dh = body.p256dh || body.keys?.p256dh || "native";
  const authSecret = body.authSecret || body.keys?.auth || "native";
  const userAgent = request.headers.get("user-agent") || body.platform || "web";

  if (action === "deregister") {
    if (endpoint) {
      await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
    } else if (userId) {
      await admin.from("push_subscriptions").delete().eq("user_id", userId);
    }
    return NextResponse.json({ success: true, message: "Device token deregistered." });
  }

  // Registration requires at least endpoint or token
  if (!endpoint) {
    return NextResponse.json({ error: "Missing device token or subscription endpoint." }, { status: 400 });
  }

  // If no auth user found, return 401
  if (!userId) {
    // Check if client provided fallback userId in body
    if (body.userId) {
      userId = body.userId;
    } else {
      return NextResponse.json({ error: "Sign in required to register device notifications." }, { status: 401 });
    }
  }

  // Upsert subscription into push_subscriptions table
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint,
    p256dh,
    auth_secret: authSecret,
    user_agent: userAgent,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" });

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to save push subscription." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Device token registered successfully." });
}

export async function DELETE(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    return NextResponse.json({ success: true, mode: "demo" });
  }
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") || searchParams.get("token");
  if (endpoint) {
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  return NextResponse.json({ success: true, message: "Device token removed." });
}
