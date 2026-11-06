import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor Branding Reflection & Persistence", () => {
  // 1. Branding API route exists and enforces role checks and admin update
  const brandingRoute = fs.readFileSync("app/api/vendor/branding/route.ts", "utf8");
  assert.ok(brandingRoute.includes('["vendor", "operations", "admin"].includes(profile.role)'), "Checks roles vendor, operations, admin");
  assert.ok(brandingRoute.includes("logo_url"), "Updates logo_url");
  assert.ok(brandingRoute.includes("banner_url"), "Updates banner_url");

  // 2. Product image upload API route allows operations as well
  const uploadRoute = fs.readFileSync("app/api/product-image-upload/route.ts", "utf8");
  assert.ok(uploadRoute.includes('"operations"'), "Operations role allowed to upload vendor images");

  // 3. lib/supabase.ts saveLiveVendorBranding uses API route with fallback
  const supabaseLib = fs.readFileSync("lib/supabase.ts", "utf8");
  assert.ok(supabaseLib.includes("/api/vendor/branding"), "Calls branding API endpoint");
  assert.ok(supabaseLib.includes("vendorBranding"), "loadLiveMarketplace returns vendorBranding");

  // 4. components/sheplates-v3.tsx customer sync maps vendor branding
  const sheplates = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  assert.ok(sheplates.includes("marketplace.vendorBranding"), "Live sync reads vendorBranding");
  assert.ok(sheplates.includes("live.vendorBranding"), "refreshMarketplace reads vendorBranding");
  assert.ok(sheplates.includes("Storefront Branding"), "EditVendorProfileDialog has branding section");
  assert.ok(sheplates.includes("handleImagePick"), "EditVendorProfileDialog has image picker");

  // 5. Operations & Admin have preview store and logo display
  assert.ok(sheplates.includes("onOpenVendorProfile={setVendorProfileId}"), "AdminArea passed onOpenVendorProfile");
  assert.ok(sheplates.includes("AdminVendors"), "AdminVendors renders vendor list");

  // 6. PhotoTile has fallback error handling and initial prop
  const kit = fs.readFileSync("components/customer-v2/kit.tsx", "utf8");
  assert.ok(kit.includes("onError={() => setLoadError(true)}"), "PhotoTile recovers from broken images");
  assert.ok(kit.includes("initial"), "PhotoTile accepts initial prop");

  // 7. VendorProfileDialog passes initial and uses PhotoTile
  const profile = fs.readFileSync("components/customer-v2/profile.tsx", "utf8");
  assert.ok(profile.includes("initial={vendor.businessName?.[0]}"), "VendorProfileDialog passes initial to PhotoTile");
  assert.ok(profile.includes("<PhotoTile imageUrl={vendor.bannerUrl}"), "VendorProfileDialog uses PhotoTile for banner");
});
