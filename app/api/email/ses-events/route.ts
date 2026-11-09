import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { suppressEmail } from "@/lib/email/outbox";
import { fetchCertificate, isAmazonUrl, parseSesEvent, verifySnsSignature, type SnsMessage } from "@/lib/email/sns";

// Amazon SNS posts SES bounces and complaints here. Set SNS_TOPIC_ARN to the topic you subscribed; anything else is refused.
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expectedTopic = process.env.SNS_TOPIC_ARN;
  if (!expectedTopic) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  let message: SnsMessage;
  try { message = JSON.parse(await request.text()); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (message.TopicArn !== expectedTopic) return NextResponse.json({ error: "Wrong topic" }, { status: 403 });
  const pem = await fetchCertificate(message.SigningCertURL).catch(() => null);
  if (!pem || !verifySnsSignature(message, pem)) return NextResponse.json({ error: "Bad signature" }, { status: 403 });

  if (message.Type === "SubscriptionConfirmation" && message.SubscribeURL && isAmazonUrl(message.SubscribeURL)) {
    await fetch(message.SubscribeURL, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    return NextResponse.json({ confirmed: true });
  }
  if (message.Type !== "Notification") return NextResponse.json({ ignored: true });
  const event = parseSesEvent(message.Message);
  if (!event) return NextResponse.json({ ignored: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const email of event.emails) await suppressEmail(admin, email, event.kind, event.detail);
  return NextResponse.json({ suppressed: event.emails.length });
}
