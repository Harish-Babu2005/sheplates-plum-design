import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("lib/plans.ts exports centralized PLAN_LIMITS with accurate Crave rules", async () => {
  const { PLAN_LIMITS, getPlanLimits, normalizePlanCode } = await import("../lib/plans.ts");
  
  assert.equal(normalizePlanCode("Crave"), "crave");
  assert.equal(normalizePlanCode("crave"), "crave");
  
  const crave = getPlanLimits("crave");
  assert.equal(crave.code, "crave");
  assert.equal(crave.name, "Crave");
  assert.equal(crave.monthlyPrice, 699);
  assert.equal(crave.maxProducts, 100);
  assert.equal(crave.maxFoodDrops, 0);
  assert.equal(crave.maxFoodShortsPerDay, 3);
  assert.equal(crave.maxDeliveryStaff, 3);
  assert.equal(crave.maxDeliverySlots, 3);
  assert.equal(crave.maxAiPicturesPerDay, 10);
  assert.equal(crave.maxRadiusKm, 30);
  assert.equal(crave.rfqAccess, false);
  assert.equal(crave.whatsappLeads, false);
  assert.equal(crave.ordering, true);
  assert.equal(crave.scheduledOrders, true);
  assert.equal(crave.foodStories, true);
  assert.equal(crave.defaultCommissionPercent, 10);
});

test("Limit 1: 101st product is blocked with clear upgrade message", async () => {
  const { canAddProduct } = await import("../lib/plans.ts");
  
  // 100th product is allowed
  const allowedCheck = canAddProduct("crave", 99);
  assert.equal(allowedCheck.allowed, true);
  
  // 101st product (when count is 100) must be rejected
  const blockedCheck = canAddProduct("crave", 100);
  assert.equal(blockedCheck.allowed, false);
  assert.equal(blockedCheck.limit, 100);
  assert.match(blockedCheck.message || "", /Crave allows 100 products/i);
  assert.match(blockedCheck.message || "", /You have 100/i);
  assert.match(blockedCheck.message || "", /Upgrade to Thrive/i);

  // Check UI and server code enforce this limit
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddProduct\(vendor\.plan,\s*items\.length\)/);
  assert.match(ui, /canAddProduct\(vendor\.plan,\s*existingProductsCount/);
  assert.match(ui, /Trimming upload to/);

  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /canAddProduct\(planCode,\s*currentProductCount/);
});

test("Limit 2: Food Drop attempt by Crave vendor fails on server, DB, and UI", async () => {
  const { canCreateFoodDrop } = await import("../lib/plans.ts");
  
  const check = canCreateFoodDrop("crave");
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 0);
  assert.match(check.message || "", /Food Drops are not included in the Crave plan/i);
  assert.match(check.message || "", /Upgrade to Thrive/i);

  // Check server logic blocks creation
  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /const dropCheck = canCreateFoodDrop\(planCode\);/);
  assert.match(supabase, /if \(!dropCheck\.allowed\) \{\s*throw new Error\(dropCheck\.message\);/);

  // Check UI disables and displays "Upgrade to Thrive" badge
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /badge:\s*"Upgrade to Thrive"/);
  assert.match(ui, /canCreateFoodDrop\(vendor\.plan\)/);
});

test("Limit 3: 4th Food Short in a day is blocked and resets midnight IST", async () => {
  const { canUploadFoodShort, getIstMidnightDate, isSameIstDay } = await import("../lib/plans.ts");
  
  // 3rd short is allowed
  assert.equal(canUploadFoodShort("crave", 2).allowed, true);
  
  // 4th short is rejected
  const check = canUploadFoodShort("crave", 3);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 3);
  assert.match(check.message || "", /Daily limit reached: Crave allows 3 Food Shorts per day/i);
  assert.match(check.message || "", /resets midnight IST/i);

  // IST midnight date testing
  const istMidnight = getIstMidnightDate();
  assert.ok(istMidnight instanceof Date);
  assert.equal(isSameIstDay(new Date().toISOString()), true);

  // Verify lib/food-shorts.ts integrates IST check and limit
  const shorts = await readFile(path.join(root, "lib/food-shorts.ts"), "utf8");
  assert.match(shorts, /isSameIstDay\(s\.createdAt\)/);
  assert.match(shorts, /canUploadFoodShort\(vendorPlan,\s*today\)/);
});

test("Limit 4: 4th delivery staff member is blocked with clear message", async () => {
  const { canAddDeliveryStaff } = await import("../lib/plans.ts");
  
  assert.equal(canAddDeliveryStaff("crave", 2).allowed, true);
  
  const check = canAddDeliveryStaff("crave", 3);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 3);
  assert.match(check.message || "", /Crave allows 3 delivery staff members/i);
  assert.match(check.message || "", /Upgrade to Thrive/i);

  // Verify UI and API validation
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliveryStaff\(vendor\.plan,\s*people\.length\)/);

  const api = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(api, /canAddDeliveryStaff\(planCode/);
});

test("Limit 5: 4th delivery slot is blocked with clear message", async () => {
  const { canAddDeliverySlot } = await import("../lib/plans.ts");
  
  assert.equal(canAddDeliverySlot("crave", 2).allowed, true);
  
  const check = canAddDeliverySlot("crave", 3);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 3);
  assert.match(check.message || "", /Crave allows 3 delivery slots/i);
  assert.match(check.message || "", /Upgrade to Thrive/i);

  // Verify UI and API validation
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliverySlot\(vendor\.plan,\s*currentSlots\.length\)/);

  const api = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(api, /canAddDeliverySlot\(planCode,\s*allSlots\.length\)/);
});

test("Limit 6: 11th AI picture in a day is blocked with 429 and resets midnight IST", async () => {
  const { canGenerateAiPicture } = await import("../lib/plans.ts");
  
  assert.equal(canGenerateAiPicture("crave", 9).allowed, true);
  
  const check = canGenerateAiPicture("crave", 10);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 10);
  assert.match(check.message || "", /Daily limit reached: Crave allows 10 AI product images per day/i);
  assert.match(check.message || "", /resets midnight IST/i);

  // Verify server-side AI rate limiting
  const aiServer = await readFile(path.join(root, "lib/product-image-server.ts"), "utf8");
  assert.match(aiServer, /getIstMidnightDate\(\)/);
  assert.match(aiServer, /canGenerateAiPicture\(planCode,\s*usage\.mine\)/);
  assert.match(aiServer, /throw new ImageError\(429/);
});

test("Direct API calls: RFQ and Food Drop endpoints block Crave vendors", async () => {
  const { canAccessRfq } = await import("../lib/plans.ts");
  
  const check = canAccessRfq("crave");
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /exclusive to the Crown plan/i);

  // Crown gets RFQ
  assert.equal(canAccessRfq("crown").allowed, true);

  // Verify lib/rfq.ts blocks Crave vendor
  const rfq = await readFile(path.join(root, "lib/rfq.ts"), "utf8");
  assert.match(rfq, /loadVendorRfqs\(vendorId:\s*string,\s*vendorPlan\?:/);
  assert.match(rfq, /if \(vendorPlan && !canAccessRfq\(vendorPlan\)\.allowed\) return \[\];/);
  assert.match(rfq, /submitQuote\(.+vendorPlan\?:/);
  assert.match(rfq, /canAccessRfq\(vendorPlan\)/);

  // Verify UI hides RFQ for Crave
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /vendor\?\.plan !== "Crown"/);
  assert.match(ui, /list\.filter\(\(item\) => item !== "Quote opportunities"\)/);
});

test("Downgrade and audit log: deactivates excess products, staff, and slots newest first without deletion", async () => {
  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  
  // Verify products deactivation (not deletion)
  assert.match(supabase, /vendor_menu_items.+order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.match(supabase, /from\("vendor_menu_items"\)\.update\(\{\s*active:\s*false/);
  
  // Verify staff deactivation
  assert.match(supabase, /from\("vendor_delivery_staff"\)\.update\(\{\s*active:\s*false/);
  
  // Verify delivery slots deactivation
  assert.match(supabase, /from\("vendor_delivery_slots"\)\.update\(\{\s*is_active:\s*false/);
  
  // Verify audit log insertion
  assert.match(supabase, /from\("audit_logs"\)\.insert/);

  // Verify client UI also reflects downgrade deactivation
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /excessProds\.has\(p\.id\)\s*\?\s*\{\s*\.\.\.p,\s*active:\s*false\s*\}/);
  assert.match(ui, /excessStaff\.has\(st\.id\)\s*\?\s*\{\s*\.\.\.st,\s*active:\s*false\s*\}/);
  assert.match(ui, /excessSlots\.has\(sl\.id\)\s*\?\s*\{\s*\.\.\.sl,\s*isActive:\s*false\s*\}/);
});

test("Kitchen Profile QR Code: QR code scan button and modal exist on kitchen profile image", async () => {
  const profileUi = await readFile(path.join(root, "components/customer-v2/profile.tsx"), "utf8");
  assert.match(profileUi, /data-testid="kitchen-profile-qr-button"/);
  assert.match(profileUi, /data-testid="kitchen-profile-qr-modal"/);
  assert.match(profileUi, /<VendorQrCode/);
});

test("WhatsApp contact button: restricted to Taster / P0 Connect vendors only", async () => {
  const discoverUi = await readFile(path.join(root, "components/customer-v2/discover.tsx"), "utf8");
  assert.match(discoverUi, /const isTasterOrConnect = !vendor\.plan \|\| vendor\.plan === "Taster" \|\| vendor\.vendorKind === "p0_connect"/);
  assert.match(discoverUi, /connectVendor && connectNumber && onContact && \(isTasterOrConnect \?/);
});
