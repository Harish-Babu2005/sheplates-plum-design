import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor QR Code Navigation & Store Profile Opening", () => {
  // 1. QR code generator in components/vendor-qr-code.tsx remains intact
  const qrComponent = fs.readFileSync("components/vendor-qr-code.tsx", "utf8");
  assert.ok(qrComponent.includes("?vendor=${vendorId}"), "QR code generates direct deep link with ?vendor=");
  assert.ok(qrComponent.includes("QRCode.toDataURL"), "QR code encodes link into image data URL");
  assert.ok(qrComponent.includes("Download QR"), "Download QR button is available");

  // 2. Pre-auth deep link preservation in components/sheplates-entry.tsx
  const entryComponent = fs.readFileSync("components/sheplates-entry.tsx", "utf8");
  assert.ok(entryComponent.includes('sessionStorage.setItem("sheplates_pending_vendor", vendorParam)'), "Preserves vendor ID in sessionStorage across auth redirects");
  assert.ok(entryComponent.includes('setAuthAudience("customer")'), "Directs scanned visitors to customer sign-in");

  // 3. Vendor deep-link resolution and store opening in components/sheplates-v3.tsx
  const app = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  assert.ok(app.includes("targetVendorId = params.get(\"vendor\")"), "Reads vendor ID from URL query parameters");
  assert.ok(app.includes("sessionStorage.getItem(\"sheplates_pending_vendor\")"), "Checks sessionStorage for vendor ID after auth redirects");
  assert.ok(app.includes("sessionStorage.removeItem(\"sheplates_pending_vendor\")"), "Cleans up sessionStorage pending vendor once handled");
  assert.ok(app.includes("Welcome to ${vendor.businessName}'s store"), "Shows welcome toast on valid vendor match");

  // 4. Invalid vendor ID handled gracefully
  assert.ok(app.includes("That vendor's store is not available right now."), "Shows user-friendly error toast for invalid vendor");
  assert.ok(app.includes("params.delete(\"vendor\")"), "Removes invalid vendor parameter from URL");

  // 5. Browser Back navigation (popstate) synchronization
  assert.ok(app.includes("window.addEventListener(\"popstate\", onPopState)"), "Registers popstate listener for back/forward navigation");
  assert.ok(app.includes("const vendorParam = parameters.get(\"vendor\")"), "popstate extracts vendor parameter");
  assert.ok(app.includes("setVendorProfileIdState(vendorParam || null)"), "popstate closes or switches store dialog without breaking URL");

  // 6. PushState & replaceState URL synchronization
  assert.ok(app.includes("window.history.pushState({ page: active, vendor: id }"), "handleOpenVendor pushes vendor state to browser history");

  // 7. Reusing existing VendorProfileDialog and addProductToCart
  assert.ok(app.includes("<VendorProfileDialog vendorId={vendorProfileId}"), "Renders unified VendorProfileDialog with vendorProfileId");
  assert.ok(app.includes("addProductToCart(state, setState, session, product)"), "Reuses existing addProductToCart handler for store profile additions");

  // 8. Removal of old conflicting grid-filter interceptor
  assert.ok(!app.includes("qrVendorHandled = useRef"), "Old qrVendorHandled interceptor removed from CustomerMarketplace");
  assert.ok(!app.includes("setVendorFilter(vendorId)"), "No longer hijacks vendor parameter for grid filtering");
});

