import { AGREEMENT_DOCUMENTS } from "./agreements.ts";

/**
 * Where a vendor stands on each document they must sign. A document counts as done when it was signed online, or when a hand-signed
 * upload was accepted by Operations. An upload waiting for review is "pending" and does not yet let the vendor be approved.
 */
export type DocState = "not_signed" | "signed_online" | "upload_pending" | "upload_accepted" | "upload_rejected";
export type SignatureRow = { document_id: string; document_version: string };
export type UploadRow = { id: string; document_id: string; document_version: string; status: "pending" | "accepted" | "rejected"; uploaded_at: string; review_note?: string | null };
export type DocStatus = { id: string; title: string; version: string; state: DocState; uploadId?: string; note?: string | null };

export function documentStatuses(signatures: SignatureRow[], uploads: UploadRow[]): DocStatus[] {
  return AGREEMENT_DOCUMENTS.map((doc) => {
    const base = { id: doc.id, title: doc.title, version: doc.version };
    if (signatures.some((s) => s.document_id === doc.id && s.document_version === doc.version)) return { ...base, state: "signed_online" as const };
    const mine = uploads.filter((u) => u.document_id === doc.id && u.document_version === doc.version).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    if (mine.some((u) => u.status === "accepted")) return { ...base, state: "upload_accepted" as const, uploadId: mine.find((u) => u.status === "accepted")!.id };
    const latest = mine[0];
    if (!latest) return { ...base, state: "not_signed" as const };
    return { ...base, state: latest.status === "pending" ? ("upload_pending" as const) : ("upload_rejected" as const), uploadId: latest.id, note: latest.review_note };
  });
}
export const isDone = (state: DocState) => state === "signed_online" || state === "upload_accepted";
export const agreementComplete = (docs: DocStatus[]) => docs.length > 0 && docs.every((d) => isDone(d.state));
export const awaitingReview = (docs: DocStatus[]) => docs.some((d) => d.state === "upload_pending");

export const STATE_LABEL: Record<DocState, string> = { not_signed: "Not signed", signed_online: "Signed online", upload_pending: "Uploaded, waiting for Operations", upload_accepted: "Signed copy accepted", upload_rejected: "Upload rejected" };

// Hand-signed uploads: a scan or photo, kept small and of a known type.
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** The file's real type from its first bytes, so a renamed file cannot pass as a PDF or image. */
export function sniffType(bytes: Uint8Array): string | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
export function validateUpload(file: { size: number; type: string }, bytes: Uint8Array): string | null {
  if (!file.size) return "The file is empty.";
  if (file.size > UPLOAD_MAX_BYTES) return "The file must be under 10 MB.";
  const real = sniffType(bytes);
  if (!real || !UPLOAD_TYPES[real]) return "Upload a PDF, PNG, JPG or WebP file.";
  if (file.type && file.type !== real && !(file.type === "image/jpg" && real === "image/jpeg")) return "The file does not match its type. Upload the scan or photo as a PDF, PNG, JPG or WebP.";
  return null;
}
export const safeFileName = (name: string) => String(name || "signed").replace(/[^\w.\- ]+/g, "_").slice(0, 80);
