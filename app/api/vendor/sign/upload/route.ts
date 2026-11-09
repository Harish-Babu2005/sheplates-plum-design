import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { AGREEMENT_DOCUMENTS } from "@/lib/agreements";
import { UPLOAD_TYPES, documentStatuses, isDone, safeFileName, sniffType, validateUpload } from "@/lib/agreement-status";
import { ownVendor, signContext } from "@/lib/sign-auth";
import { enqueueEmail } from "@/lib/email/outbox";

/**
 * A vendor who prefers paper signs by hand and uploads a scan or photo of the signed document.
 * POST multipart: vendorId, documentId, file. Operations then accepts or rejects it (see ./review).
 */
export const dynamic = "force-dynamic";
const BUCKET = "signed-agreements";
const MAX_UPLOADS_PER_DAY = 10;

export async function POST(request: Request) {
  const ctx = await signContext(request); if ("error" in ctx) return ctx.error;
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Choose the signed file to upload." }, { status: 400 }); }
  const vendor = await ownVendor(ctx.admin, String(form.get("vendorId") || ""), ctx.user.id);
  if (!vendor) return NextResponse.json({ error: "Only the vendor's owner can upload a signed document." }, { status: 403 });
  const doc = AGREEMENT_DOCUMENTS.find((d) => d.id === String(form.get("documentId") || ""));
  if (!doc) return NextResponse.json({ error: "Choose which document this is." }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose the signed file to upload." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const invalid = validateUpload({ size: file.size, type: file.type }, bytes);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Already done (signed online, or an accepted upload)? Nothing more to upload for this document.
  const [sigs, ups] = await Promise.all([
    ctx.admin.from("vendor_signatures").select("document_id,document_version").eq("vendor_id", vendor.id),
    ctx.admin.from("vendor_signature_uploads").select("id,document_id,document_version,status,uploaded_at,review_note").eq("vendor_id", vendor.id),
  ]);
  if (ups.error) return NextResponse.json({ error: "Manual upload is not set up yet. Please sign online, or ask Operations." }, { status: 503 });
  const state = documentStatuses((sigs.data || []) as { document_id: string; document_version: string }[], (ups.data || []) as never[]).find((d) => d.id === doc.id)!;
  if (isDone(state.state)) return NextResponse.json({ error: "This document is already signed." }, { status: 409 });
  const dayAgo = Date.now() - 86_400_000;
  if ((ups.data || []).filter((u) => new Date((u as { uploaded_at: string }).uploaded_at).getTime() > dayAgo).length >= MAX_UPLOADS_PER_DAY) return NextResponse.json({ error: "Too many uploads today. Please try again tomorrow." }, { status: 429 });

  const real = sniffType(bytes)!;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = `${vendor.id}/manual/${doc.id}-v${doc.version}-${crypto.randomUUID()}.${UPLOAD_TYPES[real]}`;
  const stored = await ctx.admin.storage.from(BUCKET).upload(path, bytes, { contentType: real, upsert: false });
  if (stored.error) return NextResponse.json({ error: "The file could not be stored. Please try again." }, { status: 500 });
  const saved = await ctx.admin.from("vendor_signature_uploads").insert({ vendor_id: vendor.id, document_id: doc.id, document_version: doc.version, file_path: path, file_name: safeFileName(file.name), content_type: real, file_size: bytes.length, file_sha256: hash, uploaded_by: ctx.user.id }).select("id").single();
  if (saved.error) { await ctx.admin.storage.from(BUCKET).remove([path]); return NextResponse.json({ error: "The upload could not be recorded. Please try again." }, { status: 500 }); }

  await enqueueEmail(ctx.admin, { to: process.env.AGREEMENT_COPY_TO || "partnersupport@sheplates.com", template: "agreement_uploaded", dedupeKey: `agreement_uploaded:${saved.data.id}`, data: { vendorName: vendor.name, documentTitle: doc.title, fileName: safeFileName(file.name), link: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.sheplates.com"}/` } });
  return NextResponse.json({ ok: true, uploadId: saved.data.id });
}
