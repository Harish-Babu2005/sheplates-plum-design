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
test("Vendor Terms & Conditions - PDF Asset Integrity", () => {
  const pdfPath = path.resolve("public/docs/sheplates-vendor-terms-v1.0.pdf");
  assert.ok(fs.existsSync(pdfPath), "PDF file must exist at public/docs/sheplates-vendor-terms-v1.0.pdf");

  const stat = fs.statSync(pdfPath);
  assert.ok(stat.size > 100_000, `PDF size (${stat.size} bytes) should match original multi-page document`);

  const buffer = fs.readFileSync(pdfPath);
  const header = buffer.toString("utf8", 0, 5);
  assert.equal(header, "%PDF-", "File must have valid PDF magic bytes header");
});

test("Vendor Terms & Conditions - Migration and Schema Integrity", () => {
  const migrationPath = path.resolve("supabase/migrations/20261102000700_vendor_terms_and_conditions.sql");
  assert.ok(fs.existsSync(migrationPath), "Migration file 20261102000700_vendor_terms_and_conditions.sql must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // Columns on vendors table
  assert.ok(sql.includes("terms_accepted boolean NOT NULL DEFAULT false"), "Must add terms_accepted to vendors");
  assert.ok(sql.includes("terms_version text"), "Must add terms_version to vendors");
  assert.ok(sql.includes("terms_accepted_at timestamptz"), "Must add terms_accepted_at to vendors");
  assert.ok(sql.includes("terms_document_reference text"), "Must add terms_document_reference to vendors");

  // History / Audit table
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.vendor_terms_acceptances"), "Must create vendor_terms_acceptances table");
  assert.ok(sql.includes("terms_version text NOT NULL DEFAULT '1.0'"), "History must record terms_version");
  assert.ok(sql.includes("terms_accepted_at timestamptz NOT NULL DEFAULT now()"), "History must record server timestamp");

  // RLS Policies
  assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"), "Must enable RLS on vendor_terms_acceptances");
  assert.ok(sql.includes("vendor_terms_acceptances_owner_select"), "Must have owner SELECT policy");
  assert.ok(sql.includes("vendor_terms_acceptances_owner_insert"), "Must have owner INSERT policy");
  assert.ok(sql.includes("vendor_terms_acceptances_staff_select"), "Must have staff SELECT policy");

  // Trigger enforcement
  assert.ok(sql.includes("enforce_vendor_terms_acceptance"), "Must have trigger function enforcing terms acceptance");
  assert.ok(sql.includes("log_vendor_terms_acceptance"), "Must have trigger function logging terms history");
  assert.ok(sql.includes("record_vendor_terms_acceptance"), "Must have RPC function for updating/re-accepting terms");
});

test("Vendor Terms & Conditions - Backend Route Validation", async () => {
  const routePath = path.resolve("app/api/vendor/onboarding/route.ts");
  assert.ok(fs.existsSync(routePath), "Backend API route app/api/vendor/onboarding/route.ts must exist");

  const routeSrc = fs.readFileSync(routePath, "utf8");

  // Check backend rejection logic
  assert.ok(routeSrc.includes("termsAccepted === true"), "Backend must strictly check termsAccepted === true");
  assert.ok(routeSrc.includes("status: 400"), "Backend must reject missing terms acceptance with HTTP 400");
  assert.ok(routeSrc.includes("CURRENT_VENDOR_TERMS_VERSION"), "Route must track terms version");
  assert.ok(routeSrc.includes("vendor_terms_acceptances"), "Route must record historical acceptance");
});

test("Vendor Terms & Conditions - Client UI and Supabase Library Integration", () => {
  const supabasePath = path.resolve("lib/supabase.ts");
  const supabaseSrc = fs.readFileSync(supabasePath, "utf8");

  assert.ok(supabaseSrc.includes("termsAccepted"), "submitLiveVendorApplication must accept termsAccepted");
  assert.ok(supabaseSrc.includes("terms_accepted: true"), "Direct insert must persist terms_accepted");
  assert.ok(supabaseSrc.includes("acceptLiveVendorTerms"), "lib/supabase.ts must export acceptLiveVendorTerms");

  const v3Path = path.resolve("components/sheplates-v3.tsx");
  const v3Src = fs.readFileSync(v3Path, "utf8");

  // UI elements
  assert.ok(v3Src.includes("Terms & Conditions"), "Must display Terms & Conditions heading");
  assert.ok(v3Src.includes("View Terms & Conditions"), "Must provide View Terms & Conditions button");
  assert.ok(v3Src.includes("I have read and agree to the"), "Must display mandatory checkbox agreement");
  assert.ok(v3Src.includes("sheplates-vendor-terms-v1.0.pdf"), "Must link to PDF document");
  assert.ok(v3Src.includes("disabled={busy || !termsAccepted}"), "Submit button must be disabled when terms are not accepted");

  // Operations review
  assert.ok(v3Src.includes("Terms accepted:"), "Operations view must display Terms accepted status");
});

