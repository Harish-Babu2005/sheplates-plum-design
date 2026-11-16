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
  assert.equal(thrive.maxFoodDrops, 3);
  assert.equal(thrive.maxFoodShortsPerDay, 5);
  assert.equal(thrive.maxDeliveryStaff, 10);
  assert.equal(thrive.maxDeliverySlots, 6);
  assert.equal(thrive.maxAiPicturesPerDay, 15);
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

test("Limit 2: 4th Food Drop in a day is blocked and resets midnight IST", async () => {
  const { canCreateFoodDrop, getIstMidnightDate, isSameIstDay } = await import("../lib/plans.ts");

  // 1st, 2nd, and 3rd Food Drops are allowed for Thrive
  assert.equal(canCreateFoodDrop("thrive", 0).allowed, true);
  assert.equal(canCreateFoodDrop("thrive", 1).allowed, true);
  assert.equal(canCreateFoodDrop("thrive", 2).allowed, true);

  // 4th Food Drop in the same day (count is 3) is blocked
  const check = canCreateFoodDrop("thrive", 3);
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /Daily limit reached: Thrive allows 3 Food Drops per day/i);
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
  assert.match(check.message || "", /Thrive allows 10 delivery staff members/i);
  assert.match(check.message || "", /You have 10/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliveryStaff\(vendor\.plan,\s*people\.length\)/);
});

test("Limit 5: 7th delivery slot is blocked with clear message", async () => {
  const { canAddDeliverySlot } = await import("../lib/plans.ts");

  // 6th slot allowed
  assert.equal(canAddDeliverySlot("thrive", 5).allowed, true);

  // 7th slot blocked
  const check = canAddDeliverySlot("thrive", 6);
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /Thrive allows 6 delivery slots/i);
  assert.match(check.message || "", /You have 6/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliverySlot\(vendor\.plan,\s*currentSlots\.length\)/);
});

test("Limit 6: 16th AI picture in a day is blocked and resets midnight IST", async () => {
  const { canGenerateAiPicture } = await import("../lib/plans.ts");

  // 15th picture allowed
  assert.equal(canGenerateAiPicture("thrive", 14).allowed, true);

  // 16th picture blocked
  const check = canGenerateAiPicture("thrive", 15);
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /Daily limit reached: Thrive allows 15 AI product images per day/i);
  assert.match(check.message || "", /resets midnight IST/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  const aiServer = await readFile(path.join(root, "lib/product-image-server.ts"), "utf8");
  assert.match(aiServer, /canGenerateAiPicture\(planCode,\s*usage\.mine\)/);
});

test("Direct RFQ API call from Thrive vendor is rejected (Crown only)", async () => {
  const { canAccessRfq } = await import("../lib/plans.ts");

  const check = canAccessRfq("thrive");
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /Quotation requests \(RFQ\) and AI quotation assistance are exclusive to the Crown plan/i);
  assert.match(check.message || "", /Upgrade to Crown/i);

  const rfq = await readFile(path.join(root, "lib/rfq.ts"), "utf8");
  assert.match(rfq, /canAccessRfq\(vendorPlan\)/);
});

test("Thrive navigation shows Quote opportunities greyed with 'Upgrade to Crown' badge", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /if\s*\(vendor\.plan\s*===\s*"Thrive"\)\s*\{\s*res\["Quote opportunities"\]\s*=\s*\{\s*badge:\s*"Upgrade to Crown"/);
});

test("Downgrade flow: confirmation popup appears, keeps Thrive until 1st, allows cancel, and scheduled job applies Crave", async () => {
  const {
    getNextMonthFirstIst,
    formatIstEffectiveDate,
    isScheduledDowngradeDue,
    applyScheduledPlanDowngrade,
  } = await import("../lib/plans.ts");

  // Next month first date in IST
  const nextMonth = getNextMonthFirstIst(new Date("2026-11-16T12:00:00+05:30"));
  assert.equal(nextMonth, "2026-12-01");
  assert.equal(formatIstEffectiveDate("2026-12-01"), "1 December");

  // Scheduled downgrade is NOT due prior to effective date
  assert.equal(isScheduledDowngradeDue("2026-12-01", new Date("2026-11-30T23:59:00+05:30")), false);

  // Scheduled downgrade IS due on 1st of next month
  assert.equal(isScheduledDowngradeDue("2026-12-01", new Date("2026-12-01T00:01:00+05:30")), true);

  // Confirmation popup exact wording and buttons in VerificationView
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /You can enjoy all the features of the Thrive plan until the end of this month\. Your plan will change to Crave from the 1st of next month\./);
  assert.match(ui, /Keep Thrive/);
  assert.match(ui, /Confirm/);
  assert.match(ui, /Your plan changes to/);
  assert.match(ui, /Cancel change/);

  // Scheduled job deactivates excess products (newest first, never deleting)
  const vendor = {
    id: "v_thrive_1",
    businessName: "Amma Kitchen",
    plan: "Thrive",
    scheduledPlanChange: {
      nextPlan: "Crave",
      effectiveDate: "2026-12-01",
      requestedAt: "2026-11-16T12:00:00Z",
    },
  };

  // Vendor has 105 active products
  const products = Array.from({ length: 105 }, (_, i) => ({
    id: `prod_${i + 1}`,
    vendorId: "v_thrive_1",
    active: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  // Not due on Nov 30
  const beforeDue = applyScheduledPlanDowngrade(vendor, products, new Date("2026-11-30T12:00:00+05:30"));
  assert.equal(beforeDue.applied, false);

  // Due on Dec 1
  const afterDue = applyScheduledPlanDowngrade(vendor, products, new Date("2026-12-01T01:00:00+05:30"));
  assert.equal(afterDue.applied, true);
  assert.equal(afterDue.newPlan, "Crave");
  // Crave allows 100 products, so exactly 5 newest products are deactivated
  assert.equal(afterDue.deactivatedProductIds.length, 5);
  // The deactivated products are the newest (prod_105, prod_104, prod_103, prod_102, prod_101)
  assert.deepEqual(afterDue.deactivatedProductIds, ["prod_105", "prod_104", "prod_103", "prod_102", "prod_101"]);
});

test("Food Drops visibility: hidden for customers when vendor is not Thrive/Crown, retained in vendor dashboard", async () => {
  const customerDiscover = await readFile(path.join(root, "components/customer-v2/discover.tsx"), "utf8");
  assert.match(customerDiscover, /!canCreateFoodDrop\(v\.plan\)\.allowed/);

  const customerProfile = await readFile(path.join(root, "components/customer-v2/profile.tsx"), "utf8");
  assert.match(customerProfile, /canCreateFoodDrop\(vendor\.plan\)\.allowed/);

  // Vendor dashboard keeps Food Drops history and details visible
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /Your store is on the \{vendor\.plan\} plan\. Your Food Drop history and details remain saved below/);
});
