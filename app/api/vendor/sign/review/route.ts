import { NextResponse } from "next/server";
import { AGREEMENT_DOCUMENTS } from "@/lib/agreements";
import { agreementComplete, documentStatuses } from "@/lib/agreement-status";
import { isStaff, signContext } from "@/lib/sign-auth";
import { enqueueEmail } from "@/lib/email/outbox";

/** Operations or Super Admin accepts or rejects a hand-signed upload. POST { uploadId, decision: "accepted" | "rejected", note? } (a note is required to reject). */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await signContext(request); if ("error" in ctx) return ctx.error;
  if (!isStaff(ctx.role)) return NextResponse.json({ error: "Only Operations or Super Admin can review signed documents." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const decision = body.decision === "accepted" ? "accepted" : body.decision === "rejected" ? "rejected" : null;
  const note = String(body.note || "").trim().slice(0, 500);
  if (!decision) return NextResponse.json({ error: "Choose accept or reject." }, { status: 400 });
  if (decision === "rejected" && note.length < 3) return NextResponse.json({ error: "Tell the vendor what to fix (for example: signature missing on the last page)." }, { status: 400 });

  const now = new Date().toISOString();
  // Only a pending upload can be reviewed, and only once: the update matches nothing if somebody else got there first.
  const updated = await ctx.admin.from("vendor_signature_uploads").update({ status: decision, reviewed_by: ctx.user.id, reviewed_at: now, review_note: note || null }).eq("id", String(body.uploadId || "")).eq("status", "pending").select("id,vendor_id,document_id,document_version");
  if (updated.error) return NextResponse.json({ error: "The review could not be saved." }, { status: 500 });
  const row = (updated.data || [])[0] as { id: string; vendor_id: string; document_id: string; document_version: string } | undefined;
  if (!row) return NextResponse.json({ error: "This upload was already reviewed, or no longer exists." }, { status: 409 });

  const vendor = await ctx.admin.from("vendors").select("id,name,owner_id").eq("id", row.vendor_id).maybeSingle();
  const v = vendor.data as { id: string; name: string; owner_id: string } | null;
  const doc = AGREEMENT_DOCUMENTS.find((d) => d.id === row.document_id);

  if (decision === "accepted" && v) {
    // When every document is done, the existing Terms gate that Operations relies on is updated too.
    const [sigs, ups] = await Promise.all([ctx.admin.from("vendor_signatures").select("document_id,document_version").eq("vendor_id", v.id), ctx.admin.from("vendor_signature_uploads").select("id,document_id,document_version,status,uploaded_at,review_note").eq("vendor_id", v.id)]);
    if (agreementComplete(documentStatuses((sigs.data || []) as never[], (ups.data || []) as never[]))) {
      const terms = AGREEMENT_DOCUMENTS.find((d) => d.id === "terms_conditions")!;
      await ctx.admin.from("vendors").update({ terms_accepted: true, terms_version: terms.version, terms_accepted_at: now, terms_document_reference: terms.url, updated_at: now }).eq("id", v.id);
    }
  }
  await ctx.admin.from("audit_logs").insert({ actor_id: ctx.user.id, action: `vendor_signed_upload_${decision}`, entity_type: "vendor", entity_id: row.vendor_id, metadata: { document: row.document_id, note } }).then(() => null, () => null);
  if (v?.owner_id) {
    const owner = await ctx.admin.auth.admin.getUserById(v.owner_id);
    const email = owner.data.user?.email;
    if (email) await enqueueEmail(ctx.admin, { to: email, template: "agreement_review", dedupeKey: `agreement_review:${row.id}`, data: { vendorName: v.name, documentTitle: doc?.title, decision, note, link: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.sheplates.com"}/` } });
  }
  return NextResponse.json({ ok: true, decision });
}
