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
});

test("Vendor Compliance Documents - Migration & Database Schema Integrity", () => {
  const migrationPath = path.resolve("supabase/migrations/20261103000100_vendor_compliance_documents.sql");
  assert.ok(fs.existsSync(migrationPath), "Migration file 20261103000100_vendor_compliance_documents.sql must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // Columns on vendor_documents
  assert.ok(sql.includes("file_name text"), "Must add file_name to vendor_documents");
  assert.ok(sql.includes("file_size bigint"), "Must add file_size to vendor_documents");
  assert.ok(sql.includes("mime_type text DEFAULT 'application/pdf'"), "Must enforce PDF default mime_type on vendor_documents");
  assert.ok(sql.includes("metadata jsonb DEFAULT '{}'::jsonb"), "Must add metadata jsonb to vendor_documents");

  // Columns on vendors for quick metadata
  assert.ok(sql.includes("pan_number text"), "Must add pan_number to vendors");
  assert.ok(sql.includes("bank_account_number text"), "Must add bank_account_number to vendors");
  assert.ok(sql.includes("bank_ifsc text"), "Must add bank_ifsc to vendors");
  assert.ok(sql.includes("business_registration_number text"), "Must add business_registration_number to vendors");
});

test("Vendor Compliance Documents - Strict PDF Format Validation in Backend Route", () => {
  const routePath = path.resolve("app/api/vendor/onboarding/route.ts");
  assert.ok(fs.existsSync(routePath), "Backend route app/api/vendor/onboarding/route.ts must exist");

  const routeSrc = fs.readFileSync(routePath, "utf8");

  // PDF format enforcement
  assert.ok(routeSrc.includes("application/pdf"), "Backend must check application/pdf mime type");
  assert.ok(routeSrc.includes("must be in PDF format (.pdf) only"), "Backend must reject non-PDF with clear message");
  assert.ok(routeSrc.includes("pan_number"), "Backend must support pan_number");
  assert.ok(routeSrc.includes("bank_account_number"), "Backend must support bank_account_number");
  assert.ok(routeSrc.includes("business_registration_number"), "Backend must support business_registration_number");
  assert.ok(routeSrc.includes("rawDocuments"), "Backend must process compliance documents array");
});

test("Vendor Compliance Documents - Supabase Client Library Integration", () => {
  const libPath = path.resolve("lib/supabase.ts");
  const libSrc = fs.readFileSync(libPath, "utf8");

  // Type definition and submit function
  assert.ok(libSrc.includes("OnboardingComplianceDocument"), "lib/supabase.ts must export OnboardingComplianceDocument");
  assert.ok(libSrc.includes("pan"), "Must support pan document type");
  assert.ok(libSrc.includes("government_id"), "Must support government_id document type");
  assert.ok(libSrc.includes("address_proof"), "Must support address_proof document type");
  assert.ok(libSrc.includes("bank_details"), "Must support bank_details document type");
  assert.ok(libSrc.includes("business_details"), "Must support business_details document type");
  assert.ok(libSrc.includes("product_information"), "Must support product_information document type");

  // PDF check
  assert.ok(libSrc.includes("certIsPdf"), "Must validate primary certificate is PDF");
  assert.ok(libSrc.includes("must be in PDF format (.pdf)"), "Must reject non-PDF uploads");
});

test("Vendor Compliance Documents - UI Component Integration in VendorOnboarding", () => {
  const uiPath = path.resolve("components/sheplates-v3.tsx");
  const uiSrc = fs.readFileSync(uiPath, "utf8");

  // Types
  assert.ok(uiSrc.includes("VendorComplianceDocType"), "UI must define VendorComplianceDocType");
  assert.ok(uiSrc.includes("VendorComplianceDocument"), "UI must define VendorComplianceDocument");

  // VendorOnboarding document states
  assert.ok(uiSrc.includes("panFile"), "VendorOnboarding must track panFile");
  assert.ok(uiSrc.includes("govIdFile"), "VendorOnboarding must track govIdFile");
  assert.ok(uiSrc.includes("addressProofFile"), "VendorOnboarding must track addressProofFile");
  assert.ok(uiSrc.includes("bankFile"), "VendorOnboarding must track bankFile");
  assert.ok(uiSrc.includes("businessFile"), "VendorOnboarding must track businessFile");
  assert.ok(uiSrc.includes("productInfoFile"), "VendorOnboarding must track productInfoFile");

  // Strict PDF input accept attributes
  assert.ok(uiSrc.includes('id="fssai-file-input"'), "FSSAI file input must have id");
  assert.ok(uiSrc.includes('id="pan-file-input"'), "PAN file input must have id");
  assert.ok(uiSrc.includes('id="govid-file-input"'), "Government ID file input must have id");
  assert.ok(uiSrc.includes('id="addressproof-file-input"'), "Address proof file input must have id");
  assert.ok(uiSrc.includes('id="bank-file-input"'), "Bank details file input must have id");
  assert.ok(uiSrc.includes('id="business-file-input"'), "Business details file input must have id");
  assert.ok(uiSrc.includes('id="productinfo-file-input"'), "Product info file input must have id");

  // Verification that inputs specify .pdf,application/pdf
  const pdfInputCount = (uiSrc.match(/accept="\.pdf,application\/pdf"/g) || []).length;
  assert.ok(pdfInputCount >= 7, `Must have at least 7 PDF-only file inputs (found ${pdfInputCount})`);

  // Document preview dialog
  assert.ok(uiSrc.includes("Compliance Document Preview Dialog") || uiSrc.includes("previewDoc"), "Must provide PDF preview dialog for uploaded compliance documents");

  // Operations review queue displays compliance documents
  assert.ok(uiSrc.includes("Submitted Compliance Documents (PDF)"), "OperationsVerification must display submitted compliance documents");
  assert.ok(uiSrc.includes("activeInspectPdf"), "OperationsVerification must have PDF inspector");
});

