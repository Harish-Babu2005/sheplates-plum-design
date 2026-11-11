import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor Store Promotional Brochure & High-Res QR", () => {
  const qrComponent = fs.readFileSync("components/vendor-qr-code.tsx", "utf8");

  // 1. High-Resolution Canvas Dimensions & Light Background
  assert.ok(qrComponent.includes("canvas.width = 1200"), "Brochure uses 1200px width");
  assert.ok(qrComponent.includes("canvas.height = 1600"), "Brochure uses 1600px height for optimal poster/brochure ratio");
  assert.ok(qrComponent.includes('ctx.fillStyle = "#FFFFFF"'), "Brochure uses clean white light background (not black)");

  // 2. ShePlates Branding & Logo
  assert.ok(qrComponent.includes("/brand/sheplates-wordmark-coral.png"), "Loads official ShePlates coral wordmark/logo");
  assert.ok(qrComponent.includes("HYPERLOCAL FOOD & KITCHEN NETWORK"), "Includes ShePlates network branding");
  assert.ok(qrComponent.includes("★ VERIFIED PARTNER"), "Includes official verified partner badge");
  assert.ok(qrComponent.includes("ShePlates — Fresh Home Meals & Local Kitchens, Made Simple"), "Includes approved ShePlates promotional tagline");

  // 3. Dynamic Vendor Photo/Logo & Store Details
  assert.ok(qrComponent.includes("vendorLogoUrl"), "Accepts dynamic vendor logo / profile photo");
  assert.ok(qrComponent.includes("vendorName"), "Renders dynamic vendor/store name");
  assert.ok(qrComponent.includes("vendorCategory"), "Renders dynamic vendor category");
  assert.ok(qrComponent.includes("loadImage(vendorLogoUrl)"), "Dynamically loads vendor profile photo with fallback");

  // 4. Compelling Promotional Dialogue & Badges
  assert.ok(qrComponent.includes("Handcrafted with authentic flavours and fresh ingredients"), "Includes unique promotional dialogue encouraging orders");
  assert.ok(qrComponent.includes("Cooked Fresh Daily"), "Includes service highlight for fresh daily cooking");
  assert.ok(qrComponent.includes("Instant Ordering"), "Highlights instant ordering and live menu");

  // 5. Scannable High-Quality QR Code & Compelling CTA
  assert.ok(qrComponent.includes("SCAN. EXPLORE. ORDER FRESH!"), "Prominently displays compelling CTA");
  assert.ok(qrComponent.includes("Point your phone camera to open our store directly"), "Clear scanning guidance for customers");
  assert.ok(qrComponent.includes("?vendor=${vendorId}"), "Preserves deep-link URL opening specific vendor store");
  assert.ok(qrComponent.includes("errorCorrectionLevel: \"H\""), "Uses High error correction for reliable scanning");

  // 6. Download QR Brochure & QR Code Actions
  assert.ok(qrComponent.includes("Download QR Brochure (PNG)"), "Provides primary Download QR Brochure action");
  assert.ok(qrComponent.includes("Download QR Code Only"), "Provides secondary Download QR Code action");
  assert.ok(qrComponent.includes("download={`${fileSlug}-store-brochure.png`}"), "Downloads high-resolution PNG with sanitized file slug");

  // 7. Storefront POS Integration in sheplates-v3.tsx
  const v3 = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  assert.ok(v3.includes("<VendorQrCode vendorId={vendor.id} vendorName={vendor.businessName} vendor={vendor} />"), "StorefrontPos passes full dynamic vendor object");
});

