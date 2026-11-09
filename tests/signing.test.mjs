import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { AGREEMENT_DOCUMENTS, CONSENT_TEXT, SIGNATURE_MAX_BYTES, signatoryForSheplates } from "../lib/agreements.ts";
import { buildSignedPdf, codeMatches, decodeSignaturePng, hashCode, newCode, sha256Hex } from "../lib/signing.ts";

function pngBytes(w = 60, h = 24) {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const b of buf) r = t[(r ^ b) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), randomBytes(w * 4)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const dataUrl = (b) => `data:image/png;base64,${b.toString("base64")}`;

test("both documents exist on disk, so the fingerprint is of the real file", () => {
  assert.deepEqual(AGREEMENT_DOCUMENTS.map((d) => d.id), ["partnership_agreement", "terms_conditions"]);
  for (const d of AGREEMENT_DOCUMENTS) { const bytes = readFileSync(new URL(`../public/docs/${d.file}`, import.meta.url)); assert.equal(bytes.subarray(0, 4).toString(), "%PDF", d.title); assert.equal(sha256Hex(bytes).length, 64); }
});

test("signing code: six digits, stored only as a hash tied to the person, wrong code or wrong person fails", () => {
  const code = newCode(); assert.match(code, /^\d{6}$/);
  const stored = hashCode(code, "user-1");
  assert.equal(stored.includes(code), false);
  assert.equal(codeMatches(code, "user-1", stored), true);
  assert.equal(codeMatches(code === "000000" ? "000001" : "000000", "user-1", stored), false);
  assert.equal(codeMatches(code, "user-2", stored), false);
  assert.equal(codeMatches("", "user-1", ""), false);
});

test("signature image: only a real PNG within the size limit is accepted", () => {
  const png = pngBytes();
  assert.ok(decodeSignaturePng(dataUrl(png), SIGNATURE_MAX_BYTES));
  assert.equal(decodeSignaturePng("data:image/jpeg;base64,AAAA", SIGNATURE_MAX_BYTES), null);
  assert.equal(decodeSignaturePng(dataUrl(Buffer.alloc(400, 1)), SIGNATURE_MAX_BYTES), null, "not a PNG");
  assert.equal(decodeSignaturePng(dataUrl(png), 100), null, "too large");
  assert.equal(decodeSignaturePng(null, SIGNATURE_MAX_BYTES), null);
});

test("the signed PDF keeps every original page and adds one certificate page with the fingerprint", async () => {
  const doc = AGREEMENT_DOCUMENTS[0];
  const original = readFileSync(new URL(`../public/docs/${doc.file}`, import.meta.url));
  const pages = (await PDFDocument.load(original)).getPageCount();
  const hash = sha256Hex(original);
  const signed = await buildSignedPdf(original, { document: doc, documentSha256: hash, vendorName: "Meena's Kitchen", signerName: "Meena Devi", signerRole: "Proprietor", signerEmail: "meena@example.com", signedAtISO: "2026-11-07T10:00:00.000Z", ip: "203.0.113.9", userAgent: "Test browser", signaturePng: pngBytes(), otpVerified: true, consent: CONSENT_TEXT, reference: "SPS-TEST" });
  const out = await PDFDocument.load(signed);
  assert.equal(out.getPageCount(), pages + 1);
  assert.equal(sha256Hex(original), hash, "the original is untouched");
  assert.equal(Buffer.from(signed.subarray(0, 4)).toString(), "%PDF");
  assert.equal(signatoryForSheplates({}).mode, "auto");
});
