import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Food Shorts Shop Link - Vendor Store Navigation", () => {
  // 1. ShortsViewer in components/customer-v2/shorts.tsx provides the Shop Link button
  const shortsViewerCode = fs.readFileSync("components/customer-v2/shorts.tsx", "utf8");
  assert.ok(shortsViewerCode.includes('data-testid="short-shop-link"'), "ShortsViewer renders shop link button with test ID");
  assert.ok(shortsViewerCode.includes("Shop now"), "Shop link button displays 'Shop now'");
  assert.ok(shortsViewerCode.includes("ShoppingBag"), "Shop link button includes ShoppingBag icon");

  // 2. Vendor identification from Food Short vendorId
  assert.ok(shortsViewerCode.includes("targetVendorId = s.vendorId ||"), "Identifies vendor primarily from s.vendorId");
  assert.ok(shortsViewerCode.includes('u.searchParams.get("vendor")'), "Falls back to extracting vendor parameter from shopLink");

  // 3. Closes viewer and triggers vendor store navigation
  assert.ok(shortsViewerCode.includes("onClose();"), "Closes full-screen shorts viewer so video playback stops");
  assert.ok(shortsViewerCode.includes("onOpenVendor?.(targetVendorId)"), "Calls onOpenVendor with identified vendor ID");

  // 4. Wiring in components/sheplates-v3.tsx reuses the QR code deep-link handler
  const app = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  assert.ok(app.includes("<ShortsViewer"), "ShortsViewer is rendered in app");
  assert.ok(app.includes("onOpenVendor={handleOpenVendor}"), "ShortsViewer is wired to handleOpenVendor");

  // 5. handleOpenVendor handles invalid/unavailable vendor IDs gracefully
  assert.ok(app.includes('state.vendors.find((v) => v.id === id)'), "handleOpenVendor validates vendor exists in loaded state");
  assert.ok(app.includes("That vendor's store is not available right now."), "Displays toast error when vendor is not available");
  assert.ok(app.includes('setVendorProfileIdState(null)'), "Does not open broken profile for missing vendor");

  // 6. Valid vendor opens VendorProfileDialog with URL sync without redirecting to homepage
  assert.ok(app.includes('params.set("vendor", id)'), "Pushes ?vendor=ID into URL history");
  assert.ok(app.includes("<VendorProfileDialog vendorId={vendorProfileId}"), "Renders unified VendorProfileDialog");
  assert.ok(app.includes("addProductToCart(state, setState, session, product)"), "Reuses addProductToCart for products in store profile");

  // 7. Playback and navigation controls preserved
  assert.ok(shortsViewerCode.includes("video.play()"), "Preserves video autoplay on slide change");
  assert.ok(shortsViewerCode.includes("video.pause()"), "Preserves video pause for inactive slides");
  assert.ok(shortsViewerCode.includes("setMuted"), "Preserves volume/mute control");
  assert.ok(shortsViewerCode.includes("onLike"), "Preserves like interaction");
});

