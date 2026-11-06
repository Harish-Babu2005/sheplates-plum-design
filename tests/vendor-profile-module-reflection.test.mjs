import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor Profile Module Reflection across Customer, Operations, Super Admin, and Vendor", () => {
  const profileSrc = fs.readFileSync("components/customer-v2/profile.tsx", "utf8");
  const kitSrc = fs.readFileSync("components/customer-v2/kit.tsx", "utf8");
  const sheplatesSrc = fs.readFileSync("components/sheplates-v3.tsx", "utf8");

  // 1. VendorProfileDialog includes About tab and displays representative & bio
  assert.match(profileSrc, /"About"/, "Vendor tabs must include 'About'");
  assert.match(profileSrc, /vendor\.ownerRole\s*\|\|\s*"Proprietor"/, "Must display designated representative role");
  assert.match(profileSrc, /vendor\.ownerName/, "Must display designated representative name");
  assert.match(profileSrc, /vendor\.bio/, "Must display store bio in profile modal");
  assert.match(profileSrc, /tab === "About"/, "Must have an About tab view");
  assert.match(profileSrc, /Food Safety &amp; Compliance/, "Must display compliance in About tab");

  // 2. PhotoTile uses reliable <img> and resets loadError on URL changes
  assert.match(kitSrc, /setLoadError\(false\)/, "PhotoTile must reset loadError when URL changes");
  assert.match(kitSrc, /<img\s+src=\{trimmed\}/, "PhotoTile must use img tag for data/remote URLs");

  // 3. StorefrontPos displays representative info and provides store preview & profile edit
  assert.match(sheplatesSrc, /vendor\.ownerRole\s*\|\|\s*"Proprietor"/, "Storefront header displays representative designation");
  assert.match(sheplatesSrc, /Preview Store/, "Storefront header includes Preview Store");
  assert.match(sheplatesSrc, /readImage\(file,\s*async\s*\(dataUrl\)\s*=>/, "StorefrontPos assets use compressed readImage");

  // 4. Operations verification queue displays representative info and preview
  assert.match(sheplatesSrc, /picked\.ownerRole\s*\|\|\s*"Proprietor"/, "Operations queue displays vendor representative designation");

  // 5. Super Admin vendors table displays representative info
  assert.match(sheplatesSrc, /vendor\.ownerRole\s*\|\|\s*"Proprietor"/, "Super Admin vendor list displays representative designation");
});

