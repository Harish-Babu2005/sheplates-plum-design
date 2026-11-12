import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const read = (file) => fs.readFileSync(path.resolve(file), "utf8");
const load = async (file) => {
  const out = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
};

test("Compliance documents: the database update adds file details and keeps PAN / bank numbers off the public vendor row", () => {
  const sql = read("supabase/V9_20_VENDOR_COMPLIANCE_DOCUMENTS.sql");
  for (const column of ["file_name text", "file_size bigint", "mime_type text default 'application/pdf'", "metadata jsonb default '{}'::jsonb"]) assert.ok(sql.includes(column), `adds ${column}`);
  // It must never ADD the sensitive columns to vendors (customers can read verified vendors); it only removes them when empty.
  assert.doesNotMatch(sql, /alter table public\.vendors\s+add column[^;]*(pan_number|bank_account_number|bank_ifsc|business_registration_number)/i);
  assert.match(sql, /drop column if exists pan_number/i);
  assert.match(sql, /v_used = 0/, "columns are only dropped when nothing is stored in them");
  assert.equal(fs.existsSync(path.resolve("supabase/migrations/20261104000500_vendor_compliance_documents.sql")), true);
});

test("Compliance documents: every document must be a PDF, in the form, the client library and the server route", () => {
  const route = read("app/api/vendor/onboarding/route.ts");
  assert.ok(route.includes("application/pdf") && route.includes("must be in PDF format (.pdf) only"));
  assert.ok(route.includes("rawDocuments"));
  assert.doesNotMatch(route, /pan_number|bank_account_number|bank_ifsc|business_registration_number/, "the route never writes sensitive numbers to the vendor row");
  const lib = read("lib/supabase.ts");
  assert.ok(lib.includes("OnboardingComplianceDocument") && lib.includes("must be in PDF format (.pdf)"));
  for (const type of ["pan", "government_id", "address_proof", "bank_details", "business_details", "product_information"]) assert.ok(lib.includes(type), type);
  assert.doesNotMatch(lib, /pan_number|bank_account_number|bank_ifsc|business_registration_number/);
});

test("Compliance documents: the form has all seven PDF-only uploads and a preview", () => {
  const ui = read("components/vendor-compliance.tsx") + read("lib/vendor-compliance.ts");
  for (const id of ["fssai-file-input", "pan-file-input", "govid-file-input", "addressproof-file-input", "bank-file-input", "business-file-input", "productinfo-file-input"]) assert.ok(ui.includes(id), id);
  assert.ok(ui.includes('accept=".pdf,application/pdf"'));
  assert.ok(ui.includes("Strict Document Format Requirement: PDF Only"));
  assert.ok(ui.includes("PdfPreviewDialog"));
  const app = read("components/sheplates-v3.tsx");
  assert.ok(app.includes("ComplianceStep") && app.includes("VendorComplianceDocument"));
  assert.ok(app.includes("Submitted Compliance Documents") || ui.includes("Submitted Compliance Documents (PDF)"));
});

test("Compliance rules: PDF check, field formats, and what is stored for each document", async () => {
  const c = await load("lib/vendor-compliance.ts");
  assert.equal(c.isPdfFile({ name: "a.PDF", type: "" }), true);
  assert.equal(c.isPdfFile({ name: "a.png", type: "image/png" }), false);
  assert.match(c.pdfProblem({ name: "a.jpg", type: "image/jpeg", size: 10 }, "PAN Card"), /PDF format/);
  assert.match(c.pdfProblem({ name: "a.pdf", type: "application/pdf", size: 16 * 1024 * 1024 }, "PAN Card"), /15 MB/);
  assert.equal(c.pdfProblem({ name: "a.pdf", type: "application/pdf", size: 1000 }, "PAN Card"), null);
  const f = { ...c.EMPTY_COMPLIANCE_FIELDS };
  assert.deepEqual(c.complianceFieldProblems(f), []);
  assert.equal(c.complianceFieldProblems({ ...f, panNumber: "ABC123" }).length, 1);
  assert.equal(c.complianceFieldProblems({ ...f, panNumber: "ABCDE1234F" }).length, 0);
  assert.equal(c.complianceFieldProblems({ ...f, bankAccountNumber: "50100234567890", bankIfsc: "HDFC0001234" }).length, 0);
  assert.equal(c.complianceFieldProblems({ ...f, bankAccountNumber: "50100234567890" }).length, 1, "account without IFSC");
  assert.equal(c.complianceFieldProblems({ ...f, bankIfsc: "BAD" }).length >= 1, true);
  const bank = c.documentEntry("bank_details", { ...f, bankAccountNumber: "5010 0234 5678 90", bankIfsc: "hdfc0001234", bankName: "HDFC" });
  assert.equal(bank.documentNumber, "A/C 50100234567890 · HDFC0001234");
  assert.equal(c.documentEntry("pan", { ...f, panNumber: "abcde1234f" }).documentNumber, "ABCDE1234F");
  assert.equal(c.documentEntry("pan", f).documentNumber, undefined, "nothing typed means nothing stored");
  assert.equal(c.documentTitle("government_id", { idType: "Passport" }), "Government ID (Passport)");
  assert.equal(c.maskNumber("ABCDE1234F"), "••••••234F");

  // FSSAI validation rules
  assert.equal(c.fssaiFieldProblem("", false), null, "empty FSSAI is optional during typing");
  assert.equal(c.fssaiFieldProblem("", true), "FSSAI licence number is required.");
  assert.equal(c.fssaiFieldProblem("1234ABCD567890"), "FSSAI licence number must contain digits only.");
  assert.equal(c.fssaiFieldProblem("12345"), "FSSAI licence number must be 14 digits.");
  assert.equal(c.fssaiFieldProblem("123456789012345"), "FSSAI licence number must be 14 digits.");
  assert.equal(c.fssaiFieldProblem("12423008000401"), null, "valid 14-digit FSSAI");
  assert.equal(c.FSSAI_PATTERN.test("12423008000401"), true);
  assert.equal(c.FSSAI_PATTERN.test("1242300800040"), false);
});

test("Compliance UI: FSSAI doc has field validation and auto-focus refs for required fields", () => {
  const complianceUi = read("components/vendor-compliance.tsx");
  assert.ok(complianceUi.includes("fssaiError"), "ComplianceStep accepts fssaiError");
  assert.ok(complianceUi.includes("expiryError"), "ComplianceStep accepts expiryError");
  assert.ok(complianceUi.includes("certificateError"), "ComplianceStep accepts certificateError");
  assert.ok(complianceUi.includes("fssaiInputRef"), "ComplianceStep accepts fssaiInputRef");
  assert.ok(complianceUi.includes("expiryInputRef"), "ComplianceStep accepts expiryInputRef");
  assert.ok(complianceUi.includes("err(p.fssaiError || fssaiFieldProblem(p.fssai))"), "renders FSSAI validation error under fssai input");
  assert.ok(complianceUi.includes("err(p.expiryError)"), "renders expiry validation error under expiry input");
  assert.ok(complianceUi.includes("err(p.certificateError)"), "renders certificate validation error under upload");

  const v3Ui = read("components/sheplates-v3.tsx");
  assert.ok(v3Ui.includes("businessNameRef"), "VendorOnboarding uses businessNameRef");
  assert.ok(v3Ui.includes("otherCategoryRef"), "VendorOnboarding uses otherCategoryRef");
  assert.ok(v3Ui.includes("addressRef"), "VendorOnboarding uses addressRef");
  assert.ok(v3Ui.includes("fssaiRef"), "VendorOnboarding uses fssaiRef");
  assert.ok(v3Ui.includes("expiryRef"), "VendorOnboarding uses expiryRef");
  assert.ok(v3Ui.includes("businessNameRef.current?.focus()"), "auto-focuses business name when empty");
  assert.ok(v3Ui.includes("focus(fssaiRef, \"fssai-number-input\")"), "auto-focuses FSSAI input when missing or invalid");
  assert.ok(v3Ui.includes("focus(expiryRef, \"fssai-expiry-input\")"), "auto-focuses expiry input when missing");
  assert.ok(v3Ui.includes("focus(null, \"fssai-file-input\")"), "auto-focuses FSSAI file input when certificate missing");
  assert.ok(v3Ui.includes("focus(null, \"vendor-terms-checkbox\")"), "auto-focuses terms checkbox when not accepted");
});
