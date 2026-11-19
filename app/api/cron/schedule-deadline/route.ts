import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { processScheduleDeadlines } from "@/lib/schedule-pause";

export const dynamic = "force-dynamic";

function sameSecret(given: string | null, secret: string) {
  if (!given) return false;
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Scheduled job to run daily / hourly:
// 1. Closes any schedules whose 15-day pause window has expired.
// 2. Sends Day 7, Day 13, and Day 14 pause reminders.
// Safe to run repeatedly (idempotent).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");

  // In production, require cron secret. In development, allow triggering for testing.
  if (secret && !sameSecret(headerSecret, secret)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await processScheduleDeadlines(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
