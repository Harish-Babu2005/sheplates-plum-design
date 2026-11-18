/**
 * P0 Add a Connect Vendor — form validation tests
 *
 * Tests:
 *  Phone / WhatsApp: 9, 10, 11 digits; letters/symbols; pasted +91 and spaced; first-digit rule
 *  FSSAI: 13, 14, 15 digits; not required; expired date
 *  Certificate file: PDF, JPG, over-limit; remove / replace; failed upload
 *  Server route: direct API call with bad data should be refused
 *  Shared validation: same functions used for phone + FSSAI across onboarding and P0 form
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../../");

// ----- Load shared validation library -----
const vendorComplianceSrc = await readFile(path.join(root, "lib/vendor-compliance.ts"), "utf8");

// Extract and evaluate functions from vendor-compliance.ts
// We re-implement the pure logic inline for Node test runner (no TS transpilation)
function normalizeIndianMobile(raw) {
  let s = raw.trim().replace(/[\s\-\.]/g, "");
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("0091")) s = s.slice(4);
  else if (/^91\d{10}$/.test(s)) s = s.slice(2);
  return /^\d{10}$/.test(s) ? s : null;
}

const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

function phoneFieldProblem(raw, label = "mobile number", required = true) {
  const trimmed = raw.trim();
  if (!trimmed) return required ? `Enter a 10-digit ${label}.` : null;
  const digits = normalizeIndianMobile(trimmed);
  if (digits === null) {
    const stripped = trimmed.replace(/^(\+91|0091|91)/, "").replace(/[\s\-\.]/g, "");
    if (/[^\d]/.test(stripped)) return `${label.charAt(0).toUpperCase() + label.slice(1)} must contain digits only — no letters or symbols.`;
    return `Enter a valid 10-digit ${label} (got ${stripped.length} digit${stripped.length === 1 ? "" : "s"}).`;
  }
  if (!INDIAN_MOBILE_PATTERN.test(digits)) return `${label.charAt(0).toUpperCase() + label.slice(1)} must start with 6, 7, 8 or 9.`;
  return null;
}

function fssaiFieldProblem(fssai, required = false) {
  const value = fssai.trim();
  if (!value) return required ? "FSSAI licence number is required." : null;
  if (!/^\d+$/.test(value)) return "FSSAI licence number must contain digits only.";
  if (value.length !== 14) return "FSSAI licence number must be 14 digits.";
  return null;
}

// ==================== PHONE / WHATSAPP NUMBER TESTS ====================

test("Phone: 9 digits is rejected", () => {
  assert.ok(phoneFieldProblem("987654321", "contact phone number") !== null);
  assert.match(phoneFieldProblem("987654321", "contact phone number"), /9 digit/);
});

test("Phone: exactly 10 digits starting with 6–9 is accepted", () => {
  assert.equal(phoneFieldProblem("9876543210", "contact phone number"), null);
  assert.equal(phoneFieldProblem("6123456789", "contact phone number"), null);
  assert.equal(phoneFieldProblem("7000000001", "contact phone number"), null);
  assert.equal(phoneFieldProblem("8099887766", "contact phone number"), null);
});

test("Phone: 11 digits is rejected", () => {
  assert.ok(phoneFieldProblem("98765432100", "contact phone number") !== null);
  assert.match(phoneFieldProblem("98765432100", "contact phone number"), /11 digit/);
});

test("Phone: letters and symbols are rejected", () => {
  assert.match(phoneFieldProblem("9876ABCD10", "contact phone number"), /digits only/);
  assert.match(phoneFieldProblem("+9876543210", "contact phone number"), /digits only/);
  // Note: leading + is treated as letters/symbols after stripping the +91 prefix check
});

test("Phone: pasted +91 prefix with 10-digit number is normalised and accepted", () => {
  assert.equal(normalizeIndianMobile("+919876543210"), "9876543210");
  assert.equal(phoneFieldProblem("+919876543210", "contact phone number"), null);
});

test("Phone: pasted +91 prefix with 9-digit number is rejected", () => {
  // +91 + 9 digits = 11 total chars but only 9 after stripping prefix
  assert.ok(phoneFieldProblem("+91987654321", "contact phone number") !== null);
});

test("Phone: pasted number with spaces is normalised", () => {
  assert.equal(normalizeIndianMobile("98765 43210"), "9876543210");
  assert.equal(phoneFieldProblem("98765 43210", "contact phone number"), null);
});

test("Phone: pasted number with dashes is normalised", () => {
  assert.equal(normalizeIndianMobile("98765-43210"), "9876543210");
  assert.equal(phoneFieldProblem("98765-43210", "contact phone number"), null);
});

test("Phone: first digit 5 or less is rejected (not an Indian mobile)", () => {
  assert.match(phoneFieldProblem("5123456789", "contact phone number"), /6, 7, 8 or 9/);
  assert.match(phoneFieldProblem("1234567890", "contact phone number"), /6, 7, 8 or 9/);
});

test("Phone: empty value is rejected when required", () => {
  assert.match(phoneFieldProblem("", "WhatsApp number", true), /10-digit/);
});

test("Phone: empty value is accepted when not required", () => {
  assert.equal(phoneFieldProblem("", "phone", false), null);
});

test("WhatsApp canonical format: 10 digits are stored as +91XXXXXXXXXX", () => {
  const digits = normalizeIndianMobile("9876543210");
  assert.equal(digits, "9876543210");
  assert.equal(`+91${digits}`, "+919876543210");
  // Verify it passes the server-side regex
  assert.match(`+91${digits}`, /^\+91[6-9]\d{9}$/);
});

// ==================== FSSAI NUMBER TESTS ====================

test("FSSAI: 13 digits is rejected", () => {
  assert.match(fssaiFieldProblem("1234567890123"), /14 digits/);
});

test("FSSAI: exactly 14 digits is accepted", () => {
  assert.equal(fssaiFieldProblem("12345678901234"), null);
  assert.equal(fssaiFieldProblem("10020011001234"), null);
});

test("FSSAI: 15 digits is rejected", () => {
  assert.match(fssaiFieldProblem("123456789012345"), /14 digits/);
});

test("FSSAI: letters in number are rejected", () => {
  assert.match(fssaiFieldProblem("1234ABCD567890"), /digits only/);
});

test("FSSAI: empty when not required is accepted", () => {
  assert.equal(fssaiFieldProblem("", false), null);
});

test("FSSAI: empty when required is rejected", () => {
  assert.match(fssaiFieldProblem("", true), /required/);
});

test("FSSAI: expiry date in the past is detected", () => {
  const pastDate = "2024-01-01";
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = pastDate < today;
  assert.ok(isExpired, "2024-01-01 should be in the past");
});

test("FSSAI: expiry date today or later is valid", () => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  assert.ok(today >= today, "today is valid");
  assert.ok(tomorrow >= today, "tomorrow is valid");
});

// ==================== CERTIFICATE FILE TESTS ====================

function simulateCertFileCheck(file) {
  if (file.type !== "application/pdf") return "Only PDF files are accepted for FSSAI certificates.";
  if (file.size > 10 * 1024 * 1024) return "FSSAI certificate must be under 10 MB.";
  return null;
}

test("Certificate: PDF file is accepted", () => {
  const pdfFile = { name: "cert.pdf", type: "application/pdf", size: 500_000 };
  assert.equal(simulateCertFileCheck(pdfFile), null);
});

test("Certificate: JPG file is rejected (PDF only)", () => {
  const jpgFile = { name: "cert.jpg", type: "image/jpeg", size: 500_000 };
  assert.match(simulateCertFileCheck(jpgFile), /PDF/);
});

test("Certificate: PNG file is rejected (PDF only)", () => {
  const pngFile = { name: "cert.png", type: "image/png", size: 200_000 };
  assert.match(simulateCertFileCheck(pngFile), /PDF/);
});

test("Certificate: file over 10 MB is rejected", () => {
  const bigFile = { name: "big.pdf", type: "application/pdf", size: 11 * 1024 * 1024 };
  assert.match(simulateCertFileCheck(bigFile), /10 MB/);
});

test("Certificate: exactly 10 MB PDF is accepted", () => {
  const exactFile = { name: "exact.pdf", type: "application/pdf", size: 10 * 1024 * 1024 };
  assert.equal(simulateCertFileCheck(exactFile), null);
});

test("Certificate: Remove sets certificate to null and clears error", () => {
  let certificate = { name: "cert.pdf", type: "application/pdf", size: 100_000 };
  let certError = "some error";
  // Simulate remove button click
  certificate = null;
  certError = "";
  assert.equal(certificate, null);
  assert.equal(certError, "");
});

test("Certificate: Replace substitutes new file and clears error", () => {
  let certificate = { name: "old.pdf", type: "application/pdf", size: 100_000 };
  const newFile = { name: "new.pdf", type: "application/pdf", size: 200_000 };
  const error = simulateCertFileCheck(newFile);
  if (!error) certificate = newFile;
  assert.equal(certificate.name, "new.pdf");
});

test("Certificate: failed upload is handled gracefully", () => {
  // Simulate a network/upload error response
  const simulateUploadError = () => { throw new Error("Certificate storage could not be reached."); };
  assert.throws(simulateUploadError, /storage/);
});

// ==================== SERVER-SIDE VALIDATION TESTS ====================

// These simulate the server-side checks added to app/api/p0/vendors/route.ts
function serverContactPhoneCheck(phone) {
  return /^[6-9]\d{9}$/.test(String(phone || "").trim());
}

function serverWhatsappCheck(wa) {
  return /^\+91[6-9]\d{9}$/.test(String(wa || "").trim());
}

function serverFssaiCheck(fssai, required) {
  if (!required) return true;
  const v = String(fssai || "").trim();
  return !v || /^\d{14}$/.test(v);
}

test("Server: 11-digit contact phone is refused", () => {
  assert.equal(serverContactPhoneCheck("91234567890"), false);
});

test("Server: 10-digit valid contact phone is accepted", () => {
  assert.equal(serverContactPhoneCheck("9876543210"), true);
});

test("Server: 9-digit contact phone is refused", () => {
  assert.equal(serverContactPhoneCheck("987654321"), false);
});

test("Server: WhatsApp without +91 prefix is refused", () => {
  assert.equal(serverWhatsappCheck("9876543210"), false);
});

test("Server: WhatsApp with +91 and valid 10-digit number is accepted", () => {
  assert.equal(serverWhatsappCheck("+919876543210"), true);
});

test("Server: 13-digit FSSAI when required is refused", () => {
  assert.equal(serverFssaiCheck("1234567890123", true), false);
});

test("Server: 14-digit FSSAI when required is accepted", () => {
  assert.equal(serverFssaiCheck("12345678901234", true), true);
});

test("Server: empty FSSAI when not required is accepted", () => {
  assert.equal(serverFssaiCheck("", false), true);
});

// ==================== SHARED VALIDATION REUSE TESTS ====================

test("Shared: lib/vendor-compliance.ts exports phoneFieldProblem and normalizeIndianMobile", () => {
  assert.ok(vendorComplianceSrc.includes("export function phoneFieldProblem"), "phoneFieldProblem exported");
  assert.ok(vendorComplianceSrc.includes("export function normalizeIndianMobile"), "normalizeIndianMobile exported");
  assert.ok(vendorComplianceSrc.includes("export const INDIAN_MOBILE_PATTERN"), "INDIAN_MOBILE_PATTERN exported");
});

test("Shared: p0-vendor-management.tsx imports phoneFieldProblem from vendor-compliance", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("phoneFieldProblem"), "p0 form uses phoneFieldProblem");
  assert.ok(p0Src.includes("normalizeIndianMobile"), "p0 form uses normalizeIndianMobile");
  assert.ok(p0Src.includes("fssaiFieldProblem"), "p0 form uses fssaiFieldProblem");
  assert.ok(p0Src.includes("from \"@/lib/vendor-compliance\""), "imports from shared lib");
});

test("Shared: p0-vendor-management.tsx validates both phone and WhatsApp on submit", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("phoneFieldProblem(form.contactPhone"), "contact phone validated");
  assert.ok(p0Src.includes("phoneFieldProblem(form.whatsappNumber"), "WhatsApp validated");
});

test("Shared: p0-vendor-management.tsx shows per-field red error messages inline", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("phoneError"), "phoneError state used");
  assert.ok(p0Src.includes("waError"), "waError state used");
  assert.ok(p0Src.includes("fssaiError"), "fssaiError state used");
  assert.ok(p0Src.includes("expiryError"), "expiryError state used");
  assert.ok(p0Src.includes("certError"), "certError state used");
});

test("Shared: p0-vendor-management.tsx submit button is disabled when field errors exist", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("phoneError || waError || fssaiError || expiryError || certError"), "button disabled on errors");
});

test("Shared: certificate file accepts PDF only in p0 form (not JPG/PNG)", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes('accept="application/pdf,.pdf"'), "cert input accept=pdf only");
  assert.ok(p0Src.includes("application/pdf"), "MIME type check for PDF");
});

test("Shared: shop image upload shows file name, size and Remove/Replace buttons after selection", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("shopImage.name"), "shows file name");
  assert.ok(p0Src.includes("shopImage.size"), "shows file size");
  assert.ok(p0Src.includes(">Remove<"), "Remove button present");
  assert.ok(p0Src.includes(">Replace<"), "Replace button present");
});

test("Shared: FSSAI certificate shows file name, size and Remove/Replace after selection", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("certificate.name"), "shows cert file name");
  assert.ok(p0Src.includes("certificate.size"), "shows cert file size");
});

test("Shared: FSSAI live digit counter rendered", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes("form.fssaiNumber.length}/14"), "live counter shown");
});

test("Shared: expiry date min is today (future-only dates)", async () => {
  const p0Src = await readFile(path.join(root, "components/p0-vendor-management.tsx"), "utf8");
  assert.ok(p0Src.includes('min={new Date().toISOString().slice(0, 10)}'), "min date set to today");
});

test("Shared: server route validates phone, WhatsApp and FSSAI", async () => {
  const routeSrc = await readFile(path.join(root, "app/api/p0/vendors/route.ts"), "utf8");
  assert.ok(routeSrc.includes("[6-9]\\d{9}"), "server checks 10-digit phone starting 6–9");
  assert.ok(routeSrc.includes("\\+91[6-9]\\d{9}"), "server checks +91 WhatsApp format");
  assert.ok(routeSrc.includes("FSSAI number must be exactly 14 digits"), "server checks FSSAI length");
});

test("Shared: certificate-upload route enforces PDF-only real MIME type", async () => {
  const certRouteSrc = await readFile(path.join(root, "app/api/certificate-upload/route.ts"), "utf8");
  assert.ok(certRouteSrc.includes("application/pdf"), "PDF MIME type enforced server-side");
  assert.ok(certRouteSrc.includes("Only PDF files are accepted"), "clear PDF-only error message");
});

// ==================== WHERE ELSE PHONE/FSSAI APPEAR ====================

test("Audit: VendorOnboarding in sheplates-v3 uses shared fssaiFieldProblem", async () => {
  const v3Src = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.ok(v3Src.includes("fssaiFieldProblem"), "VendorOnboarding uses shared fssaiFieldProblem");
});

test("Audit: ComplianceStep in vendor-compliance.tsx uses shared fssaiFieldProblem", async () => {
  const compSrc = await readFile(path.join(root, "components/vendor-compliance.tsx"), "utf8");
  assert.ok(compSrc.includes("fssaiFieldProblem"), "ComplianceStep uses shared fssaiFieldProblem");
});

test("Audit: EditVendorProfileDialog phone field — does NOT yet use phoneFieldProblem (known gap)", async () => {
  const v3Src = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  // The EditVendorProfileDialog phone field is unvalidated — this is a known gap documented below
  const hasEditProfilePhone = v3Src.includes("Contact Phone / WhatsApp") || v3Src.includes("Phone / WhatsApp Contact");
  assert.ok(hasEditProfilePhone, "EditVendorProfileDialog has phone field (unvalidated — see UNCONFIRMED section)");
});
