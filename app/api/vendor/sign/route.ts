import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AGREEMENT_DOCUMENTS, CONSENT_TEXT, OTP_MAX_SENDS_PER_HOUR, OTP_MAX_TRIES, OTP_MINUTES, SIGNATURE_MAX_BYTES, signatoryForSheplates } from "@/lib/agreements";
import { buildSignedPdf, codeMatches, decodeSignaturePng, hashCode, newCode, sha256Hex } from "@/lib/signing";
import { clientIp, isStaff, ownVendor, signContext } from "@/lib/sign-auth";
import { agreementComplete, documentStatuses } from "@/lib/agreement-status";
import { enqueueEmail } from "@/lib/email/outbox";
import { renderEmail } from "@/lib/email/templates";
import { getTransport } from "@/lib/email/transport";

/**
 * Online signing for the Vendor Partnership Agreement and the Terms & Conditions.
 *   GET  ?vendorId=...                     which documents are signed, with short-lived download links
 *   POST { action: "send_code", vendorId } emails a 6 digit code to the signed-in vendor
 *   POST { action: "sign", vendorId, signerName, signerRole, code, signaturePng, consent: true, documents: [ids] }
 * Only the vendor's own owner can sign. Everything is recorded on the server: who, when, from where, which exact file (SHA-256).
 */
export const dynamic = "force-dynamic";
const BUCKET = "signed-agreements";

const readDoc = (file: string) => readFile(path.join(process.cwd(), "public", "docs", file));

export async function GET(request: Request) {
  const ctx = await signContext(request); if ("error" in ctx) return ctx.error;
  const vendorId = new URL(request.url).searchParams.get("vendorId") || "";
  const staff = isStaff(ctx.role);
  if (!vendorId || (!staff && !(await ownVendor(ctx.admin, vendorId, ctx.user.id)))) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const [sigRows, uploadRows] = await Promise.all([
    ctx.admin.from("vendor_signatures").select("document_id,document_version,signer_name,signed_at,signed_pdf_path,reference").eq("vendor_id", vendorId),
    ctx.admin.from("vendor_signature_uploads").select("id,document_id,document_version,file_name,uploaded_at,status,review_note,file_path").eq("vendor_id", vendorId).order("uploaded_at", { ascending: false }),
  ]);
  const signed = (sigRows.data || []) as { document_id: string; document_version: string; signer_name: string; signed_at: string; signed_pdf_path: string; reference: string }[];
  const uploads = (uploadRows.error ? [] : uploadRows.data || []) as { id: string; document_id: string; document_version: string; file_name: string; uploaded_at: string; status: "pending" | "accepted" | "rejected"; review_note: string | null; file_path: string }[];
  const states = documentStatuses(signed, uploads);
  const documents = await Promise.all(AGREEMENT_DOCUMENTS.map(async (doc) => {
    const row = signed.find((r) => r.document_id === doc.id && r.document_version === doc.version);
    const link = row ? (await ctx.admin.storage.from(BUCKET).createSignedUrl(row.signed_pdf_path, 120)).data?.signedUrl : undefined;
    const state = states.find((x) => x.id === doc.id)!;
    const latest = uploads.find((u) => u.document_id === doc.id && u.document_version === doc.version);
    const uploadLink = latest ? (await ctx.admin.storage.from(BUCKET).createSignedUrl(latest.file_path, 120)).data?.signedUrl : undefined;
    return { id: doc.id, title: doc.title, version: doc.version, url: doc.url, signed: Boolean(row), signedBy: row?.signer_name, signedAt: row?.signed_at, reference: row?.reference, signedPdfUrl: link,
      state: state.state, note: state.note, upload: latest ? { id: latest.id, fileName: latest.file_name, uploadedAt: latest.uploaded_at, status: latest.status, note: latest.review_note, url: uploadLink } : undefined };
  }));
  return NextResponse.json({ documents, allSigned: agreementComplete(states), allDone: agreementComplete(states) });
}

export async function POST(request: Request) {
  const ctx = await signContext(request); if ("error" in ctx) return ctx.error;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const vendor = await ownVendor(ctx.admin, String(body.vendorId || ""), ctx.user.id);
  if (!vendor) return NextResponse.json({ error: "Only the vendor's owner can sign." }, { status: 403 });
  const email = ctx.user.email;
  if (!email) return NextResponse.json({ error: "Your account has no email address to send the code to." }, { status: 400 });

  if (body.action === "send_code") {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const recent = await ctx.admin.from("signing_codes").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).gte("created_at", hourAgo);
    if ((recent.count || 0) >= OTP_MAX_SENDS_PER_HOUR) return NextResponse.json({ error: "Too many codes requested. Please try again in an hour." }, { status: 429 });
    const code = newCode();
    const stored = await ctx.admin.from("signing_codes").insert({ user_id: ctx.user.id, vendor_id: vendor.id, code_hash: hashCode(code, ctx.user.id), expires_at: new Date(Date.now() + OTP_MINUTES * 60_000).toISOString() });
    if (stored.error) return NextResponse.json({ error: "Could not create a code. Please try again." }, { status: 500 });
    try { await getTransport().send({ to: email, ...renderEmail("signing_code", { code }) }); }
    catch { return NextResponse.json({ error: "We could not send the email. Please try again in a minute." }, { status: 502 }); }
    return NextResponse.json({ ok: true, sentTo: email.replace(/^(.).*(@.*)$/, "$1***$2"), expiresInMinutes: OTP_MINUTES });
  }

  if (body.action !== "sign") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const signerName = String(body.signerName || "").trim().replace(/\s+/g, " "), signerRole = String(body.signerRole || "").trim().slice(0, 60) || "Authorised representative";
  if (signerName.length < 3 || signerName.length > 80 || !/[A-Za-zऀ-෿]/.test(signerName)) return NextResponse.json({ error: "Type your full name." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Tick the box to agree to both documents." }, { status: 400 });
  const wanted = Array.isArray(body.documents) ? body.documents.map(String) : [];
  if (!AGREEMENT_DOCUMENTS.every((d) => wanted.includes(d.id))) return NextResponse.json({ error: "Both the Partnership Agreement and the Terms & Conditions must be signed together." }, { status: 400 });
  const png = decodeSignaturePng(body.signaturePng, SIGNATURE_MAX_BYTES);
  if (!png) return NextResponse.json({ error: "Draw your signature in the box." }, { status: 400 });

  // The code: newest unused one for this person, not expired, not guessed too often.
  const latest = await ctx.admin.from("signing_codes").select("id,code_hash,expires_at,tries").eq("user_id", ctx.user.id).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const codeRow = latest.data as { id: string; code_hash: string; expires_at: string; tries: number } | null;
  if (!codeRow || new Date(codeRow.expires_at) < new Date()) return NextResponse.json({ error: "The code has expired. Ask for a new one." }, { status: 400 });
  if (codeRow.tries >= OTP_MAX_TRIES) return NextResponse.json({ error: "Too many wrong codes. Ask for a new one." }, { status: 429 });
  if (!codeMatches(String(body.code || ""), ctx.user.id, codeRow.code_hash)) {
    await ctx.admin.from("signing_codes").update({ tries: codeRow.tries + 1 }).eq("id", codeRow.id);
    return NextResponse.json({ error: "That code is not right." }, { status: 400 });
  }
  const used = await ctx.admin.from("signing_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id).is("used_at", null).select("id");
  if (!used.data?.length) return NextResponse.json({ error: "That code was already used. Ask for a new one." }, { status: 400 });

  const signedAt = new Date(), signedAtISO = signedAt.toISOString(), ip = clientIp(request), userAgent = (request.headers.get("user-agent") || "").slice(0, 300);
  const sheplates = signatoryForSheplates();
  const attachments: { bucket: string; path: string; filename: string; contentType: string }[] = [];
  let lastReference = "", lastHash = "";
  for (const doc of AGREEMENT_DOCUMENTS) {
    const existing = await ctx.admin.from("vendor_signatures").select("id").eq("vendor_id", vendor.id).eq("document_id", doc.id).eq("document_version", doc.version).maybeSingle();
    if (existing.data) continue; // already signed this version: never sign twice
    const original = await readDoc(doc.file);
    const documentSha256 = sha256Hex(original);
    const reference = `SPS-${signedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${documentSha256.slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const pdf = await buildSignedPdf(original, { document: doc, documentSha256, vendorName: vendor.name, signerName, signerRole, signerEmail: email, signedAtISO, ip, userAgent, signaturePng: png, otpVerified: true, consent: CONSENT_TEXT, reference });
    const pdfPath = `${vendor.id}/${doc.id}-v${doc.version}-${reference}.pdf`, sigPath = `${vendor.id}/${doc.id}-v${doc.version}-${reference}.png`;
    const up = await ctx.admin.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
    if (up.error) return NextResponse.json({ error: "The signed copy could not be stored. Nothing was signed; please try again." }, { status: 500 });
    await ctx.admin.storage.from(BUCKET).upload(sigPath, png, { contentType: "image/png", upsert: false });
    const saved = await ctx.admin.from("vendor_signatures").insert({ reference, vendor_id: vendor.id, user_id: ctx.user.id, document_id: doc.id, document_version: doc.version, document_sha256: documentSha256, signer_name: signerName, signer_role: signerRole, signer_email: email, otp_verified: true, consent_text: CONSENT_TEXT, ip_address: ip || null, user_agent: userAgent || null, signed_at: signedAtISO, signed_pdf_path: pdfPath, signature_png_path: sigPath, countersigned_name: sheplates.name, countersigned_title: sheplates.title, countersigned_at: signedAtISO });
    if (saved.error && saved.error.code !== "23505") return NextResponse.json({ error: "The signature could not be recorded. Please try again." }, { status: 500 });
    attachments.push({ bucket: BUCKET, path: pdfPath, filename: `${doc.title.replace(/[^A-Za-z0-9]+/g, "-")}-signed.pdf`, contentType: "application/pdf" });
    lastReference = reference; lastHash = documentSha256;
  }

  // The existing Terms gate that Operations relies on is updated from here too, so approval works as before.
  const terms = AGREEMENT_DOCUMENTS.find((d) => d.id === "terms_conditions")!;
  await ctx.admin.from("vendors").update({ terms_accepted: true, terms_version: terms.version, terms_accepted_at: signedAtISO, terms_document_reference: terms.url, updated_at: signedAtISO }).eq("id", vendor.id);
  await ctx.admin.from("vendor_terms_acceptances").insert({ vendor_id: vendor.id, user_id: ctx.user.id, terms_version: terms.version, terms_accepted: true, terms_accepted_at: signedAtISO, terms_document_reference: terms.url });
  await ctx.admin.from("audit_logs").insert({ actor_id: ctx.user.id, action: "vendor_signed_agreements", entity_type: "vendor", entity_id: vendor.id, metadata: { signer: signerName, ip, versions: AGREEMENT_DOCUMENTS.map((d) => `${d.id}:${d.version}`) } }).then(() => null, () => null);

  if (attachments.length) {
    const data = { vendorName: vendor.name, signerName, signedAt: signedAtISO.replace("T", " ").slice(0, 16) + " UTC", version: AGREEMENT_DOCUMENTS.map((d) => `${d.title} v${d.version}`).join(", "), hash: lastHash };
    await enqueueEmail(ctx.admin, { to: email, template: "agreement_signed", data, attachments, dedupeKey: `agreement_signed:${vendor.id}:${lastReference}` });
    const copyTo = process.env.AGREEMENT_COPY_TO || "partnersupport@sheplates.com";
    await enqueueEmail(ctx.admin, { to: copyTo, template: "agreement_signed", data, attachments, dedupeKey: `agreement_signed_copy:${vendor.id}:${lastReference}` });
  }
  return NextResponse.json({ ok: true, signedAt: signedAtISO, reference: lastReference });
}
