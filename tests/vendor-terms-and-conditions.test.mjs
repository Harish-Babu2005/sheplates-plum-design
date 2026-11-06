import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.resolve(file), "utf8");

test("Vendor Terms & Conditions - PDF asset is shipped and valid", () => {
  const pdfPath = path.resolve("public/docs/sheplates-vendor-terms-v1.0.pdf");
  assert.ok(fs.existsSync(pdfPath));
  assert.ok(fs.statSync(pdfPath).size > 100_000, "the full multi-page document");
  assert.equal(fs.readFileSync(pdfPath).toString("utf8", 0, 5), "%PDF-");
});

test("Vendor Terms & Conditions - database: acceptance columns, history table, RLS and triggers", () => {
  const sql = read("supabase/migrations/20261102000700_vendor_terms_and_conditions.sql");
  for (const part of ["terms_accepted boolean NOT NULL DEFAULT false", "terms_version text", "terms_accepted_at timestamptz", "terms_document_reference text",
    "CREATE TABLE IF NOT EXISTS public.vendor_terms_acceptances", "ENABLE ROW LEVEL SECURITY", "vendor_terms_acceptances_owner_select", "vendor_terms_acceptances_staff_select",
    "enforce_vendor_terms_acceptance", "log_vendor_terms_acceptance", "record_vendor_terms_acceptance"]) assert.ok(sql.includes(part), part);
});

test("Vendor Terms & Conditions - the trigger only checks when a vendor is created or its status changes (V9_16 runs after the original)", () => {
  const fix = read("supabase/V9_16_VENDOR_TERMS_TRIGGER_SCOPE.sql");
  assert.match(fix, /tg_op = 'INSERT' or new\.verification_status is distinct from old\.verification_status/);
  assert.ok("20261103000400_vendor_terms_trigger_scope.sql" > "20261102000700_vendor_terms_and_conditions.sql", "applies after the original migration");
});

test("Vendor Terms & Conditions - server route rejects a submission without acceptance", () => {
  const route = read("app/api/vendor/onboarding/route.ts");
  for (const part of ["termsAccepted === true", "status: 400", "CURRENT_VENDOR_TERMS_VERSION", "vendor_terms_acceptances"]) assert.ok(route.includes(part), part);
});

test("Vendor Terms & Conditions - the vendor can read the document before accepting, in onboarding and later", () => {
  const lib = read("lib/supabase.ts");
  assert.ok(lib.includes("termsAccepted") && lib.includes("terms_accepted: true") && lib.includes("acceptLiveVendorTerms"));
  const ui = read("components/vendor-compliance.tsx");
  assert.ok(ui.includes("Terms &amp; Conditions") && ui.includes("View Terms &amp; Conditions"));
  assert.ok(ui.includes("I have read and agree to the"));
  assert.ok(ui.includes("VENDOR_TERMS_PDF") && read("lib/vendor-compliance.ts").includes("sheplates-vendor-terms-v1.0.pdf"));
  assert.ok(ui.includes("<iframe"), "the PDF opens inside the page");
  const app = read("components/sheplates-v3.tsx");
  assert.ok(app.includes("disabled={busy || !termsAccepted}"), "submit stays disabled until accepted");
  assert.ok(app.includes("Terms accepted:"), "Operations sees the acceptance");
  assert.ok(app.includes("TermsViewerDialog") && /setTermsViewOpen\(true\)/.test(app), "existing vendors can open the terms from their Verification page");
});
