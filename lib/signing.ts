import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { signatoryForSheplates, type AgreementDocument } from "./agreements.ts";

export const sha256Hex = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

export function newCode(): string { return String(randomInt(0, 1_000_000)).padStart(6, "0"); }
/** The code is stored only as a hash tied to the person, so a leaked table cannot be used to sign. */
export function hashCode(code: string, userId: string, pepper = process.env.SIGNING_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev"): string { return sha256Hex(`${pepper}:${userId}:${code}`); }
export function codeMatches(code: string, userId: string, expectedHash: string): boolean {
  const a = Buffer.from(hashCode(String(code || "").trim(), userId), "hex"), b = Buffer.from(expectedHash || "", "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Accepts only a real PNG drawn by the pad, within the size limit. */
export function decodeSignaturePng(dataUrl: unknown, maxBytes: number): Buffer | null {
  const m = typeof dataUrl === "string" ? dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return null;
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length < 200 || bytes.length > maxBytes) return null;
  return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? bytes : null;
}

export type AuditDetails = {
  document: AgreementDocument; documentSha256: string; vendorName: string; signerName: string; signerRole: string; signerEmail: string;
  signedAtISO: string; ip: string; userAgent: string; signaturePng: Buffer; otpVerified: boolean; consent: string; reference: string;
};

const wrapText = (text: string, max: number) => { const out: string[] = []; let line = ""; for (const word of text.split(/\s+/)) { if ((line + " " + word).trim().length > max) { out.push(line); line = word; } else line = (line + " " + word).trim(); } if (line) out.push(line); return out; };
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "?"); // the built-in PDF fonts only draw plain characters

/** The original document untouched, plus one added "Certificate of electronic signature" page. */
export async function buildSignedPdf(original: Uint8Array, audit: AuditDetails): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original, { ignoreEncryption: true });
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold), font = await pdf.embedFont(StandardFonts.Helvetica), mono = await pdf.embedFont(StandardFonts.Courier);
  const teal = rgb(0.082, 0.373, 0.396), ink = rgb(0.125, 0.157, 0.153), grey = rgb(0.33, 0.4, 0.42);
  let y = 790;
  page.drawText("Sheplates", { x: 48, y, size: 22, font: bold, color: rgb(0.945, 0.357, 0.353) });
  y -= 30; page.drawText("Certificate of electronic signature", { x: 48, y, size: 16, font: bold, color: teal });
  y -= 22; page.drawText(ascii(`${audit.document.title} - version ${audit.document.version}`), { x: 48, y, size: 11, font, color: ink });
  y -= 14; page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: teal });
  const sheplates = signatoryForSheplates();
  const rows: [string, string][] = [
    ["Reference", audit.reference], ["Vendor", audit.vendorName], ["Signed by", `${audit.signerName} (${audit.signerRole})`], ["Signer email", audit.signerEmail],
    ["Signed at (UTC)", audit.signedAtISO], ["Email code verified", audit.otpVerified ? "Yes" : "No"], ["IP address", audit.ip || "not available"], ["Device", audit.userAgent.slice(0, 90) || "not available"],
    ["Countersigned for Sheplates", `${sheplates.name}, ${sheplates.title} (applied automatically on signing)`],
  ];
  y -= 24;
  for (const [label, value] of rows) {
    page.drawText(ascii(label), { x: 48, y, size: 9, font: bold, color: grey });
    const lines = wrapText(ascii(value), 68);
    lines.forEach((line, i) => page.drawText(line, { x: 190, y: y - i * 12, size: 10, font, color: ink }));
    y -= Math.max(1, lines.length) * 12 + 8;
  }
  y -= 4; page.drawText("Document fingerprint (SHA-256) of the exact file signed", { x: 48, y, size: 9, font: bold, color: grey });
  y -= 14; page.drawText(audit.documentSha256.slice(0, 32), { x: 48, y, size: 9.5, font: mono, color: ink });
  y -= 12; page.drawText(audit.documentSha256.slice(32), { x: 48, y, size: 9.5, font: mono, color: ink });
  y -= 26; page.drawText("What the signer agreed to", { x: 48, y, size: 9, font: bold, color: grey });
  for (const line of wrapText(ascii(audit.consent), 96)) { y -= 13; page.drawText(line, { x: 48, y, size: 9.5, font, color: ink }); }
  const image = await pdf.embedPng(audit.signaturePng);
  const scale = Math.min(220 / image.width, 80 / image.height);
  y -= 24; page.drawText("Drawn signature", { x: 48, y, size: 9, font: bold, color: grey });
  y -= image.height * scale + 6;
  page.drawRectangle({ x: 48, y: y - 4, width: 232, height: image.height * scale + 8, borderColor: grey, borderWidth: 0.5 });
  page.drawImage(image, { x: 52, y, width: image.width * scale, height: image.height * scale });
  y -= 36;
  for (const line of wrapText("This page was added automatically when the document was signed online. Changing any page of the document changes its fingerprint, so the original can always be checked against the fingerprint above.", 100)) { page.drawText(line, { x: 48, y, size: 8.5, font, color: grey }); y -= 11; }
  pdf.setTitle(`${audit.document.title} (signed)`); pdf.setProducer("Sheplates e-sign"); pdf.setCreator("Sheplates");
  return pdf.save();
}
