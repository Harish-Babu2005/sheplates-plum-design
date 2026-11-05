import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor Profile Edit: designation options, EditVendorProfileDialog, and Representative details", () => {
  const sheplates = fs.readFileSync("components/sheplates-v3.tsx", "utf8");

  // VENDOR_DESIGNATION_OPTIONS
  for (const role of ["Proprietor", "Owner", "Partner", "Director", "Designated Representative"]) {
    assert.ok(sheplates.includes(`"${role}"`), `Includes designation role: ${role}`);
  }

  // Vendor type has ownerRole, phone, bio
  assert.match(sheplates, /ownerRole\?: string;/);
  assert.match(sheplates, /phone\?: string;/);
  assert.match(sheplates, /bio\?: string;/);

  // EditVendorProfileDialog exists and is wired
  assert.ok(sheplates.includes("export function EditVendorProfileDialog"));
  assert.ok(sheplates.includes("Edit Store Profile") || sheplates.includes("Edit Store & Representative Profile"));
  assert.ok(sheplates.includes("Representative Designation"));
  assert.ok(sheplates.includes("saveLiveVendorProfile"));

  // Check lib/supabase.ts exports saveLiveVendorProfile
  const supabaseLib = fs.readFileSync("lib/supabase.ts", "utf8");
  assert.ok(supabaseLib.includes("export async function saveLiveVendorProfile"));
});

test("Compliance Step: dropdown selector for compliance documents", () => {
  const compliance = fs.readFileSync("components/vendor-compliance.tsx", "utf8");
  assert.ok(compliance.includes("id=\"compliance-doc-select\""));
  assert.ok(compliance.includes("activeDocKey"));
  assert.ok(compliance.includes("Previous:"));
  assert.ok(compliance.includes("Next:"));
});

test("Food Drops: Available at 8 PM button uses warm peach-orange #E1AE9B instead of pink", () => {
  const discover = fs.readFileSync("components/customer-v2/discover.tsx", "utf8");
  const profile = fs.readFileSync("components/customer-v2/profile.tsx", "utf8");

  assert.match(discover, /bg-\[#E1AE9B\]/);
  assert.match(profile, /bg-\[#E1AE9B\]/);
  assert.doesNotMatch(discover, /bg-\[#E[9|B|8][0-9A-Fa-f]{4}\]/, "No pink buttons in discover");
});

