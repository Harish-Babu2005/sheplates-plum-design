import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("lib/plans.ts exports centralized PLAN_LIMITS with accurate Thrive rules", async () => {
  const { PLAN_LIMITS, getPlanLimits, normalizePlanCode } = await import("../lib/plans.ts");
  
  assert.equal(normalizePlanCode("Thrive"), "thrive");
  assert.equal(normalizePlanCode("thrive"), "thrive");
  
  const thrive = getPlanLimits("thrive");
  assert.equal(thrive.code, "thrive");
  assert.equal(thrive.name, "Thrive");
  assert.equal(thrive.monthlyPrice, 799);
  assert.equal(thrive.maxProducts, 300);
  assert.equal(thrive.maxFoodDrops, 5);
  assert.equal(thrive.maxFoodShortsPerDay, 5);
  assert.equal(thrive.maxDeliveryStaff, 10);
  assert.equal(thrive.maxDeliverySlots, Infinity);
  assert.equal(thrive.maxAiPicturesPerDay, undefined);
  assert.equal(thrive.maxRadiusKm, 30);
  assert.equal(thrive.rfqAccess, false);
  assert.equal(thrive.whatsappLeads, false);
  assert.equal(thrive.ordering, true);
  assert.equal(thrive.scheduledOrders, true);
  assert.equal(thrive.foodStories, true);
  assert.equal(thrive.defaultCommissionPercent, 10);
});

test("Limit 1: 301st product is blocked with clear upgrade message", async () => {
  const { canAddProduct } = await import("../lib/plans.ts");
  
  // 300th product is allowed (when count is 299)
  const allowedCheck = canAddProduct("thrive", 299);
  assert.equal(allowedCheck.allowed, true);
  
  // 301st product (when count is 300) must be rejected
  const blockedCheck = canAddProduct("thrive", 300);
  assert.equal(blockedCheck.allowed, false);
  assert.equal(blockedCheck.limit, 300);
  assert.match(blockedCheck.message || "", /Thrive allows 300 products/i);
  assert.match(blockedCheck.message || "", /You have 300/i);
  assert.match(blockedCheck.message || "", /Upgrade to Crown/i);

  // Check UI and server code enforce this limit
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddProduct\(vendor\.plan,\s*items\.length\)/);
  assert.match(ui, /canAddProduct\(vendor\.plan,\s*existingProductsCount/);
  assert.match(ui, /Trimming upload to/);

  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /canAddProduct\(planCode,\s*currentProductCount/);
});

test("Limit 2: 6th Food Drop in a day is blocked and resets midnight IST", async () => {
  const { canCreateFoodDrop, getIstMidnightDate, isSameIstDay } = await import("../lib/plans.ts");

  // 1st through 5th Food Drops are allowed for Thrive
  for (let i = 0; i < 5; i++) {
    assert.equal(canCreateFoodDrop("thrive", i).allowed, true);
  }

  // 6th Food Drop in the same day (count is 5) is blocked
  const check = canCreateFoodDrop("thrive", 5);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 5);
  assert.match(check.message || "", /Daily limit reached: Thrive allows 5 Food Drops per day/i);
  assert.match(check.message || "", /resets midnight IST/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  // Midnight IST reset test
  const istMidnight = getIstMidnightDate();
  assert.equal(istMidnight.getHours(), 0);
  assert.equal(istMidnight.getMinutes(), 0);

  const prevDay = new Date(Date.now() - 26 * 60 * 60 * 1000);
  assert.equal(isSameIstDay(prevDay.toISOString()), false);

  // Verification in UI and supabase
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canCreateFoodDrop\(vendor\.plan,\s*todayDropCount\)/);

  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /canCreateFoodDrop\(planCode,\s*count\s*\|\|\s*0\)/);
});

test("Limit 3: 6th Food Short in a day is blocked and resets midnight IST", async () => {
  const { canUploadFoodShort } = await import("../lib/plans.ts");

  // 5th short (count is 4) is allowed
  assert.equal(canUploadFoodShort("thrive", 4).allowed, true);

  // 6th short (count is 5) is rejected
  const check = canUploadFoodShort("thrive", 5);
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /Daily limit reached: Thrive allows 5 Food Shorts per day/i);
  assert.match(check.message || "", /resets midnight IST/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  // Check food-shorts.ts integration
  const shorts = await readFile(path.join(root, "lib/food-shorts.ts"), "utf8");
  assert.match(shorts, /canUploadFoodShort\(vendorPlan,\s*today\)/);
});

test("Limit 4: 11th delivery staff member is blocked with clear message", async () => {
  const { canAddDeliveryStaff } = await import("../lib/plans.ts");

  // 10th staff member allowed
  assert.equal(canAddDeliveryStaff("thrive", 9).allowed, true);

  // 11th staff member blocked
  const check = canAddDeliveryStaff("thrive", 10);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 10);
  assert.match(check.message || "", /Thrive allows 10 delivery staff members/i);
  assert.match(check.message || "", /You have 10/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliveryStaff\(vendor\.plan,\s*people\.length\)/);
});

test("Limit 5: Delivery slots are unlimited on Thrive (no slot cap in code or database)", async () => {
  const { canAddDeliverySlot } = await import("../lib/plans.ts");

  // Slots are unlimited on Thrive
  for (let i = 0; i <= 30; i += 5) {
    assert.equal(canAddDeliverySlot("thrive", i).allowed, true);
    assert.equal(canAddDeliverySlot("thrive", i).limit, Infinity);
  }

  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliverySlot\(vendor\.plan,\s*currentSlots\.length\)/);
});

test("Limit 6: AI picture limit is deleted from Thrive (and all plans) - no cap remains", async () => {
  const { canGenerateAiPicture } = await import("../lib/plans.ts");

  // Unlimited AI pictures
  assert.equal(canGenerateAiPicture("thrive", 0).allowed, true);
  assert.equal(canGenerateAiPicture("thrive", 50).allowed, true);
  assert.equal(canGenerateAiPicture("thrive", 100).limit, Infinity);

  // Daily counter check removed from server
  const aiServer = await readFile(path.join(root, "lib/product-image-server.ts"), "utf8");
  assert.doesNotMatch(aiServer, /usage\.mine >= VENDOR_DAILY_LIMIT/);
  assert.doesNotMatch(aiServer, /Your store has reached its daily limit for AI images/);
});

test("Direct RFQ API call from Thrive vendor is rejected (Crown only)", async () => {
  const { canAccessRfq } = await import("../lib/plans.ts");

  const check = canAccessRfq("thrive");
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /exclusive to the Crown plan/i);
});

test("Food Drops visibility: Food Drops do not vanish when vendor is on Crave, Thrive or Crown", async () => {
  const { canCreateFoodDrop } = await import("../lib/plans.ts");
  assert.equal(canCreateFoodDrop("crave").allowed, true);
  assert.equal(canCreateFoodDrop("thrive").allowed, true);
  assert.equal(canCreateFoodDrop("crown").allowed, true);
  assert.equal(canCreateFoodDrop("taster").allowed, false);

  // Customer discover filters vendors by canCreateFoodDrop(v.plan).allowed
  const discover = await readFile(path.join(root, "components/customer-v2/discover.tsx"), "utf8");
  assert.match(discover, /canCreateFoodDrop\(v\.plan\)\.allowed/);

  // Vendor dashboard keeps Food Drops history and details visible
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /Your store is on the \{vendor\.plan\} plan\. Your Food Drop history and details remain saved below/);
});

test("Scheduled downgrade to Crave: deactivates excess products and staff (slots unlimited)", async () => {
  const { applyScheduledPlanDowngrade } = await import("../lib/plans.ts");

  const vendor = {
    id: "v_thrive_1",
    businessName: "Spice Garden",
    plan: "Thrive",
    scheduledPlanChange: {
      nextPlan: "Crave",
      effectiveDate: "2026-12-01",
      requestedAt: "2026-11-16T10:00:00Z",
    },
  };

  // 105 products (Crave limit 100) -> 5 excess deactivated
  const prods = Array.from({ length: 105 }, (_, i) => ({
    id: `prod_${i + 1}`,
    vendorId: "v_thrive_1",
    active: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  // 7 staff members (Crave limit 5) -> 2 excess deactivated
  const staff = Array.from({ length: 7 }, (_, i) => ({
    id: `staff_${i + 1}`,
    vendorId: "v_thrive_1",
    active: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  // 10 delivery slots -> unlimited on Crave -> 0 deactivated
  const slots = Array.from({ length: 10 }, (_, i) => ({
    id: `slot_${i + 1}`,
    vendorId: "v_thrive_1",
    isActive: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  const res = applyScheduledPlanDowngrade(vendor, prods, staff, slots, new Date("2026-12-01T01:00:00+05:30"));
  assert.equal(res.applied, true);
  assert.equal(res.newPlan, "Crave");
  assert.equal(res.deactivatedProductIds.length, 5);
  assert.equal(res.deactivatedStaffIds.length, 2);
  assert.deepEqual(res.deactivatedStaffIds, ["staff_7", "staff_6"]);
  assert.equal(res.deactivatedSlotIds.length, 0);
});
