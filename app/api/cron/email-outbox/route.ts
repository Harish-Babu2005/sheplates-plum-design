import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { processOutbox } from "@/lib/email/outbox";
import { getTransport } from "@/lib/email/transport";

// Sends queued email. Run it every minute from the server's crontab:
//   curl -fsS -X POST https://app.sheplates.com/api/cron/email-outbox -H "x-cron-secret: $CRON_SECRET"
export const dynamic = "force-dynamic";
function sameSecret(given: string | null, secret: string) {
  if (!given) return false;
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("x-cron-secret"), secret)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try { return NextResponse.json(await processOutbox(admin, getTransport())); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 500 }); }
}
