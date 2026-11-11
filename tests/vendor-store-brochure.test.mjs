import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor Store Promotional Brochure & High-Res QR", () => {
  const qrComponent = fs.readFileSync("components/vendor-qr-code.tsx", "utf8");

  // 1. High-Resolution Canvas Dimensions & Colors
  assert.ok(qrComponent.includes("canvas.width = 1200"), "Brochure uses 1200px width");
  assert.ok(qrComponent.includes("canvas.height = 1600"), "Brochure uses 1600px height for optimal poster/brochure ratio");
  assert.ok(qrComponent.includes('ctx.fillStyle = "#FFFFFF"'), "Brochure uses clean white card background for QR section");

  // 2. ShePlates Branding & Logo
  assert.ok(qrComponent.includes("/brand/sheplates-wordmark-coral.png"), "Loads official ShePlates coral wordmark/logo");
  assert.ok(qrComponent.includes("HYPERLOCAL"), "Includes ShePlates HYPERLOCAL network branding");
  assert.ok(qrComponent.includes("FOOD & KITCHEN NETWORK"), "Includes FOOD & KITCHEN NETWORK tagline");
  assert.ok(qrComponent.includes("ShePlates — Fresh Home Meals & Local Kitchens, Made Simple"), "Includes approved ShePlates promotional tagline");
  assert.ok(qrComponent.includes("Support Local Kitchens"), "Includes Support Local Kitchens community message");

  // 3. Dynamic Vendor Photo/Logo & Store Details
  assert.ok(qrComponent.includes("vendorLogoUrl"), "Accepts dynamic vendor logo / profile photo");
  assert.ok(qrComponent.includes("vendorName"), "Renders dynamic vendor/store name");
  assert.ok(qrComponent.includes("vendorCategory"), "Renders dynamic vendor category");
  assert.ok(qrComponent.includes("loadImage(vendorLogoUrl)"), "Dynamically loads vendor profile photo with fallback");

  // 4. Approved Promotional Dialogue & Highlighted Text
  assert.ok(qrComponent.includes("Your favourite local kitchen"), "Includes approved dialogue heading");
  assert.ok(qrComponent.includes("scan away."), "Highlights 'scan away.' in light green");

  // 5. Scannable High-Quality QR Code & Corner Brackets & CTA
  assert.ok(qrComponent.includes("Scan. Explore."), "Prominently displays Scan. Explore.");
  assert.ok(qrComponent.includes("Order Fresh!"), "Prominently displays Order Fresh!");
  assert.ok(qrComponent.includes("Point your phone camera to open this store directly."), "Clear scanning guidance for customers");
  assert.ok(qrComponent.includes("Visit Store Now →"), "Includes prominent Visit Store Now button");
  assert.ok(qrComponent.includes("drawCornerBrackets"), "Draws 4 corner brackets around the QR code");
  assert.ok(qrComponent.includes("?vendor=${vendorId}"), "Preserves deep-link URL opening specific vendor store");
  assert.ok(qrComponent.includes("errorCorrectionLevel: \"H\""), "Uses High error correction for reliable scanning");

  // 6. Download QR Brochure & QR Code Actions
  assert.ok(qrComponent.includes("Download QR Brochure (PNG)"), "Provides primary Download QR Brochure action");
  assert.ok(qrComponent.includes("Download QR Code Only"), "Provides secondary Download QR Code action");
  assert.ok(qrComponent.includes("download={`${fileSlug}-store-brochure.png`}"), "Downloads high-resolution PNG with sanitized file slug");

  // 7. Storefront POS Integration in sheplates-v3.tsx
  const v3 = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  assert.ok(v3.includes("<VendorQrCode vendorId={vendor.id} vendorName={vendor.businessName} vendor={vendor}"), "StorefrontPos passes full dynamic vendor object");
  assert.ok(v3.includes("onOpenStore={onOpenVendorProfile}"), "StorefrontPos connects onOpenVendorProfile to brochure preview CTA");
});
