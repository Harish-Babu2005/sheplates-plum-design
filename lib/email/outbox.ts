import type { SupabaseClient } from "@supabase/supabase-js";
import { renderEmail, type EmailTemplate } from "./templates.ts";
import { PermanentEmailError, type Attachment, type EmailTransport } from "./transport.ts";

/**
 * Email outbox. Sending never happens inside a customer's request: the app only writes a row (enqueueEmail, which cannot fail
 * the request), and a worker (processOutbox, run every minute by cron) sends it, retries on temporary errors with a growing
 * wait, and gives up after MAX_ATTEMPTS. A dedupe key makes sure the same event never sends the same mail twice.
 */
export const MAX_ATTEMPTS = 6;
export const RETRY_MINUTES = [1, 5, 30, 120, 360, 720];
const BUCKET = "email-attachments";

export type EnqueueInput = { to: string; template: EmailTemplate; data: Record<string, unknown>; dedupeKey?: string; attachments?: { bucket?: string; path: string; filename: string; contentType: string }[]; sendAfter?: Date };

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(value);
}

export async function enqueueEmail(admin: SupabaseClient, input: EnqueueInput): Promise<boolean> {
  try {
    const to = String(input.to || "").trim().toLowerCase();
    if (!validEmail(to)) return false;
    const { error } = await admin.from("email_outbox").insert({ to_email: to, template: input.template, data: input.data, dedupe_key: input.dedupeKey || null, attachments: input.attachments || [], next_attempt_at: (input.sendAfter || new Date()).toISOString() });
    if (error && error.code !== "23505") { console.error("email enqueue failed", error.message); return false; } // 23505 = already queued
    return !error;
  } catch (error) { console.error("email enqueue failed", (error as Error).message); return false; }
}

type Row = { id: string; to_email: string; template: EmailTemplate; data: Record<string, unknown>; attempts: number; attachments: { bucket?: string; path: string; filename: string; contentType: string }[] | null };

export async function processOutbox(admin: SupabaseClient, transport: EmailTransport, options: { limit?: number; now?: Date } = {}) {
  const now = options.now || new Date();
  const result = { picked: 0, sent: 0, retried: 0, failed: 0, suppressed: 0 };
  // Rows stuck in "sending" (the worker died) are released after 10 minutes.
  await admin.from("email_outbox").update({ status: "pending" }).eq("status", "sending").lt("updated_at", new Date(now.getTime() - 10 * 60_000).toISOString());
  const due = await admin.from("email_outbox").select("id,to_email,template,data,attempts,attachments").eq("status", "pending").lte("next_attempt_at", now.toISOString()).order("next_attempt_at", { ascending: true }).limit(options.limit || 25);
  if (due.error) throw due.error;
  for (const row of (due.data || []) as Row[]) {
    // Claim the row; if another worker already did, skip it.
    const claim = await admin.from("email_outbox").update({ status: "sending", attempts: row.attempts + 1, updated_at: now.toISOString() }).eq("id", row.id).eq("status", "pending").select("id");
    if (claim.error || !claim.data?.length) continue;
    result.picked++;
    const attempts = row.attempts + 1;
    try {
      const blocked = await admin.from("email_suppressions").select("email").eq("email", row.to_email).maybeSingle();
      if (blocked.data) { await admin.from("email_outbox").update({ status: "suppressed", updated_at: now.toISOString() }).eq("id", row.id); result.suppressed++; continue; }
      const rendered = renderEmail(row.template, row.data || {});
      const attachments: Attachment[] = [];
      for (const file of row.attachments || []) {
        const download = await admin.storage.from(file.bucket || BUCKET).download(file.path);
        if (download.error || !download.data) throw new Error(`attachment ${file.path} unavailable`);
        attachments.push({ filename: file.filename, contentType: file.contentType, content: Buffer.from(await download.data.arrayBuffer()) });
      }
      const sent = await transport.send({ to: row.to_email, ...rendered, attachments });
      await admin.from("email_outbox").update({ status: "sent", message_id: sent.messageId, sent_at: now.toISOString(), last_error: null, updated_at: now.toISOString() }).eq("id", row.id);
      result.sent++;
    } catch (error) {
      const message = String((error as Error)?.message || error).slice(0, 500);
      const permanent = error instanceof PermanentEmailError || attempts >= MAX_ATTEMPTS;
      const wait = RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)];
      await admin.from("email_outbox").update(permanent ? { status: "failed", last_error: message, updated_at: now.toISOString() } : { status: "pending", last_error: message, next_attempt_at: new Date(now.getTime() + wait * 60_000).toISOString(), updated_at: now.toISOString() }).eq("id", row.id);
      if (permanent) result.failed++; else result.retried++;
    }
  }
  return result;
}

export async function suppressEmail(admin: SupabaseClient, email: string, reason: "bounce" | "complaint" | "manual", detail?: string) {
  const address = email.trim().toLowerCase();
  if (!validEmail(address)) return;
  await admin.from("email_suppressions").upsert({ email: address, reason, detail: detail?.slice(0, 500) || null }, { onConflict: "email" });
  await admin.from("email_outbox").update({ status: "suppressed" }).eq("to_email", address).eq("status", "pending");
}
