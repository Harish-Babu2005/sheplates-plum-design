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
  assert.equal(crave.maxFoodDrops, 2);
  assert.equal(crave.maxFoodShortsPerDay, 3);
  assert.equal(crave.maxDeliveryStaff, 5);
  assert.equal(crave.maxDeliverySlots, Infinity);
  assert.equal(crave.maxAiPicturesPerDay, undefined);
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

test("Limit 2: Food Drops on Crave - 3rd Food Drop in a day is blocked, Crave menu is available", async () => {
  const { canCreateFoodDrop } = await import("../lib/plans.ts");
  
  // Crave vendors get Food Drops (allowed)
  assert.equal(canCreateFoodDrop("crave").allowed, true);

  // 1st and 2nd Food Drops are allowed
  assert.equal(canCreateFoodDrop("crave", 0).allowed, true);
  assert.equal(canCreateFoodDrop("crave", 1).allowed, true);

  // 3rd Food Drop in the same day (count is 2) is blocked
  const check = canCreateFoodDrop("crave", 2);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 2);
  assert.match(check.message || "", /Daily limit reached: Crave allows 2 Food Drops per day \(resets midnight IST\)\./i);
  assert.match(check.message || "", /Upgrade to Thrive for more\./i);

  // Food Drops menu item for Crave is available (not locked with Upgrade to Thrive)
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canCreateFoodDrop\(vendor\.plan\)\.allowed/);
  // Crave is included in isPlanAllowed for FoodDropsManager
  assert.match(ui, /isPlanAllowed\s*=\s*\["Crave",\s*"Thrive",\s*"Crown"\]\.includes\(vendor\.plan\)/);

  // Check server logic enforces daily limit
  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /const dropCheck = canCreateFoodDrop\(planCode\);/);
  assert.match(supabase, /if \(!dropCheck\.allowed\) \{\s*throw new Error\(dropCheck\.message\);/);
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

test("Limit 4: 6th delivery staff member is blocked with clear message (limit 5 on Crave)", async () => {
  const { canAddDeliveryStaff } = await import("../lib/plans.ts");
  
  // Staff 1 through 5 are allowed
  for (let i = 0; i < 5; i++) {
    assert.equal(canAddDeliveryStaff("crave", i).allowed, true);
  }
  
  // 6th staff member (count is 5) is blocked
  const check = canAddDeliveryStaff("crave", 5);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 5);
  assert.match(check.message || "", /Crave allows 5 delivery staff members\. You have 5\. Upgrade to Thrive to add more\./i);

  // Verify UI and API validation
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliveryStaff\(vendor\.plan,\s*people\.length\)/);

  const api = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(api, /canAddDeliveryStaff\(planCode/);
});

test("Limit 5: Delivery slots are unlimited on Crave (no slot cap in code or database)", async () => {
  const { canAddDeliverySlot } = await import("../lib/plans.ts");
  
  // Unlimited slots on Crave
  for (let i = 0; i <= 20; i += 5) {
    assert.equal(canAddDeliverySlot("crave", i).allowed, true);
    assert.equal(canAddDeliverySlot("crave", i).limit, Infinity);
  }

  // Verify UI and API validation
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliverySlot\(vendor\.plan,\s*currentSlots\.length\)/);

  const api = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(api, /canAddDeliverySlot\(planCode,\s*allSlots\.length\)/);
});

test("Limit 6: AI picture limit is deleted from Crave (and all plans) - no cap remains", async () => {
  const { canGenerateAiPicture } = await import("../lib/plans.ts");
  
  // AI pictures are unlimited across all plans
  assert.equal(canGenerateAiPicture("crave", 0).allowed, true);
  assert.equal(canGenerateAiPicture("crave", 50).allowed, true);
  assert.equal(canGenerateAiPicture("crave", 100).limit, Infinity);

  // Verify server-side vendor daily counter check has been removed
  const aiServer = await readFile(path.join(root, "lib/product-image-server.ts"), "utf8");
  assert.doesNotMatch(aiServer, /usage\.mine >= VENDOR_DAILY_LIMIT/);
  assert.doesNotMatch(aiServer, /Your store has reached its daily limit for AI images/);
});

test("Direct API calls: RFQ endpoints block Crave vendors (Crown only)", async () => {
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

test("Downgrade and audit log: deactivates excess products and staff (slots unlimited)", async () => {
  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  
  // Verify products deactivation (not deletion)
  assert.match(supabase, /vendor_menu_items.+order\("created_at",\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.match(supabase, /from\("vendor_menu_items"\)\.update\(\{\s*active:\s*false/);
  
  // Verify staff deactivation
  assert.match(supabase, /from\("vendor_delivery_staff"\)\.update\(\{\s*active:\s*false/);
  
  // Verify audit log insertion
  assert.match(supabase, /from\("audit_logs"\)\.insert/);

  // Verify client UI also reflects downgrade deactivation
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /excessProds\.has\(p\.id\)\s*\?\s*\{\s*\.\.\.p,\s*active:\s*false\s*\}/);
  assert.match(ui, /excessStaff\.has\(st\.id\)\s*\?\s*\{\s*\.\.\.st,\s*active:\s*false\s*\}/);
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
