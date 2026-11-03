import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

