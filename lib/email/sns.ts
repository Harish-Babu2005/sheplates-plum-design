import { createVerify } from "node:crypto";

/**
 * Amazon SNS delivers SES bounce and complaint notices to our webhook. Anyone can POST to a public URL, so every message is
 * checked: its signature must verify against a certificate that really comes from amazonaws.com, and its topic must be ours.
 */
export type SnsMessage = { Type: string; MessageId: string; TopicArn: string; Message: string; Timestamp: string; SignatureVersion: string; Signature: string; SigningCertURL: string; SubscribeURL?: string; Subject?: string; Token?: string };

const CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;
export function isAmazonUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === "https:" && CERT_HOST.test(u.hostname); } catch { return false; }
}

export function stringToSign(m: SnsMessage): string {
  const fields = m.Type === "Notification" ? ["Message", "MessageId", ...(m.Subject !== undefined ? ["Subject"] : []), "Timestamp", "TopicArn", "Type"] : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  return fields.map((f) => `${f}\n${(m as unknown as Record<string, string>)[f]}\n`).join("");
}

export function verifySnsSignature(m: SnsMessage, certificatePem: string): boolean {
  try {
    const verifier = createVerify(m.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1");
    verifier.update(stringToSign(m), "utf8");
    return verifier.verify(certificatePem, m.Signature, "base64");
  } catch { return false; }
}

const certCache = new Map<string, string>();
export async function fetchCertificate(url: string): Promise<string | null> {
  if (!isAmazonUrl(url)) return null;
  const cached = certCache.get(url);
  if (cached) return cached;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  const pem = await response.text();
  certCache.set(url, pem);
  return pem;
}

export type FeedbackEvent = { kind: "bounce" | "complaint"; emails: string[]; detail: string };
/** Reads an SES event; only permanent bounces and complaints should stop future mail. */
export function parseSesEvent(raw: string): FeedbackEvent | null {
  type Recipient = { emailAddress: string };
  type Body = { notificationType?: string; eventType?: string; bounce?: { bounceType?: string; bounceSubType?: string; bouncedRecipients?: Recipient[] }; complaint?: { complaintFeedbackType?: string; complainedRecipients?: Recipient[] } };
  let body: Body;
  try { body = JSON.parse(raw); } catch { return null; }
  const type = body.notificationType || body.eventType;
  if (type === "Bounce" && body.bounce?.bounceType === "Permanent") return { kind: "bounce", emails: (body.bounce.bouncedRecipients || []).map((r) => r.emailAddress), detail: String(body.bounce.bounceSubType || "Permanent") };
  if (type === "Complaint") return { kind: "complaint", emails: (body.complaint?.complainedRecipients || []).map((r) => r.emailAddress), detail: String(body.complaint?.complaintFeedbackType || "complaint") };
  return null;
}
