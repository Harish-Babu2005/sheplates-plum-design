import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("lib/plans.ts exports centralized PLAN_LIMITS with accurate Crown rules", async () => {
  const { PLAN_LIMITS, getPlanLimits, normalizePlanCode } = await import("../lib/plans.ts");

  assert.equal(normalizePlanCode("Crown"), "crown");
  assert.equal(normalizePlanCode("crown"), "crown");
  assert.equal(normalizePlanCode("Premium"), "crown");

  const crown = getPlanLimits("crown");
  assert.equal(crown.code, "crown");
  assert.equal(crown.name, "Crown");
  assert.equal(crown.monthlyPrice, 999);
  assert.equal(crown.maxProducts, Infinity);
  assert.equal(crown.maxFoodDrops, 15);
  assert.equal(crown.maxFoodShortsPerDay, 10);
  assert.equal(crown.maxDeliveryStaff, 20);
  assert.equal(crown.maxDeliverySlots, Infinity);
  assert.equal(crown.maxAiPicturesPerDay, undefined);
  assert.equal(crown.maxRadiusKm, 30);
  assert.equal(crown.rfqAccess, true);
  assert.equal(crown.whatsappLeads, false);
  assert.equal(crown.ordering, true);
  assert.equal(crown.scheduledOrders, true);
  assert.equal(crown.foodStories, true);
  assert.equal(crown.priorityAlerts, true);
  assert.equal(crown.defaultCommissionPercent, 10);
});

test("Limit 1: Unlimited products and bulk upload has no product cap on Crown", async () => {
  const { canAddProduct } = await import("../lib/plans.ts");

  // Unlimited products on Crown
  assert.equal(canAddProduct("crown", 0).allowed, true);
  assert.equal(canAddProduct("crown", 100).allowed, true);
  assert.equal(canAddProduct("crown", 300).allowed, true);
  assert.equal(canAddProduct("crown", 1000).allowed, true);
  assert.equal(canAddProduct("crown", 1000).limit, Infinity);
});

test("Limit 2: 16th Food Drop in a day is blocked and resets midnight IST", async () => {
  const { canCreateFoodDrop, getIstMidnightDate, isSameIstDay } = await import("../lib/plans.ts");

  // Drops 1 through 15 are allowed on Crown
  for (let i = 0; i < 15; i++) {
    assert.equal(canCreateFoodDrop("crown", i).allowed, true);
  }

  // 16th Food Drop in a day (count is 15) must be rejected
  const check = canCreateFoodDrop("crown", 15);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 15);
  assert.match(check.message || "", /Daily limit reached: Crown allows 15 Food Drops per day \(resets midnight IST\)\./i);

  // Midnight IST reset test
  const istMidnight = getIstMidnightDate();
  assert.equal(istMidnight.getHours(), 0);
  assert.equal(istMidnight.getMinutes(), 0);

  const prevDay = new Date(Date.now() - 26 * 60 * 60 * 1000);
  assert.equal(isSameIstDay(prevDay.toISOString()), false);

  // Server & DB enforcement verification
  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /const dropCheck = canCreateFoodDrop\(planCode\);/);
  assert.match(supabase, /const dailyCheck = canCreateFoodDrop\(planCode,\s*count\s*\|\|\s*0\);/);
});

test("Limit 3: 11th Food Short in a day is blocked and resets midnight IST", async () => {
  const { canUploadFoodShort } = await import("../lib/plans.ts");

  // 10th short (count is 9) is allowed
  assert.equal(canUploadFoodShort("crown", 9).allowed, true);

  // 11th short (count is 10) is rejected
  const check = canUploadFoodShort("crown", 10);
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /Daily limit reached: Crown allows 10 Food Shorts per day \(resets midnight IST\)\./i);

  // Check food-shorts.ts integration
  const shorts = await readFile(path.join(root, "lib/food-shorts.ts"), "utf8");
  assert.match(shorts, /canUploadFoodShort\(vendorPlan,\s*today\)/);
});

test("Limit 4: 21st delivery staff member is blocked with clear message (limit 20 on Crown)", async () => {
  const { canAddDeliveryStaff } = await import("../lib/plans.ts");

  // Staff members 1 to 20 are allowed
  for (let i = 0; i < 20; i++) {
    assert.equal(canAddDeliveryStaff("crown", i).allowed, true);
  }

  // 21st staff member (count is 20) is blocked
  const check = canAddDeliveryStaff("crown", 20);
  assert.equal(check.allowed, false);
  assert.equal(check.limit, 20);
  assert.match(check.message || "", /Crown allows 20 delivery staff members\. You have 20\./i);
});

test("Limit 5: Delivery slots are unlimited on Crown (no slot cap in code or database)", async () => {
  const { canAddDeliverySlot } = await import("../lib/plans.ts");

  // Slots are unlimited on Crown
  for (let i = 0; i <= 50; i += 10) {
    assert.equal(canAddDeliverySlot("crown", i).allowed, true);
    assert.equal(canAddDeliverySlot("crown", i).limit, Infinity);
  }

  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /canAddDeliverySlot\(vendor\.plan,\s*currentSlots\.length\)/);
});

test("Limit 6: AI picture limit is deleted from Crown (and all plans) - no cap remains", async () => {
  const { canGenerateAiPicture } = await import("../lib/plans.ts");

  // AI pictures are unlimited across all plans
  assert.equal(canGenerateAiPicture("crown", 0).allowed, true);
  assert.equal(canGenerateAiPicture("crown", 50).allowed, true);
  assert.equal(canGenerateAiPicture("crown", 100).limit, Infinity);

  // Daily counter check removed from server
  const aiServer = await readFile(path.join(root, "lib/product-image-server.ts"), "utf8");
  assert.doesNotMatch(aiServer, /usage\.mine >= VENDOR_DAILY_LIMIT/);
  assert.doesNotMatch(aiServer, /Your store has reached its daily limit for AI images/);
});

test("WhatsApp restriction: direct API call to WhatsApp lead endpoint from Crown vendor must fail", async () => {
  const { canAccessWhatsAppLeads } = await import("../lib/plans.ts");

  // Crown vendors must NOT have WhatsApp leads access
  const check = canAccessWhatsAppLeads("crown");
  assert.equal(check.allowed, false);
  assert.match(check.message || "", /exclusive to the Taster plan/i);
  assert.match(check.message || "", /Selling plans \(Crave, Thrive, Crown\) use the integrated cart and checkout/i);

  // Verify trackLiveVendorWhatsAppClick in lib/supabase.ts checks plan and throws error
  const supabase = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(supabase, /canAccessWhatsAppLeads\(vendorPlan\)/);
  assert.match(supabase, /WhatsApp contact buttons and lead tracking are exclusive to the Taster plan/);

  // Verify app/api/whatsapp/route.ts verifies plan and blocks non-Taster with 403
  const route = await readFile(path.join(root, "app/api/whatsapp/route.ts"), "utf8");
  assert.match(route, /canAccessWhatsAppLeads/);
  assert.match(route, /status:\s*403/);

  // Verify customer discover hides WhatsApp button for Crown
  const discoverUi = await readFile(path.join(root, "components/customer-v2/discover.tsx"), "utf8");
  assert.match(discoverUi, /const isTasterOrConnect = !vendor\.plan \|\| vendor\.plan === "Taster" \|\| vendor\.vendorKind === "p0_connect"/);
});

test("RFQ access: Crown vendors get full RFQ opportunities, quotation assistant, and quotes", async () => {
  const { canAccessRfq } = await import("../lib/plans.ts");

  const check = canAccessRfq("crown");
  assert.equal(check.allowed, true);

  // Crown vendors get RFQ tools
  const rfq = await readFile(path.join(root, "lib/rfq.ts"), "utf8");
  assert.match(rfq, /canAccessRfq\(vendorPlan\)/);

  // Operations/Admin and customer quote list logic
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /Quote opportunities/);
  assert.match(ui, /LiveVendorRfqs/);
});

test("Priority and demand alerts: Crown vendors receive priority alerts", async () => {
  const { getPlanLimits } = await import("../lib/plans.ts");

  const crown = getPlanLimits("crown");
  assert.equal(crown.priorityAlerts, true);

  const thrive = getPlanLimits("thrive");
  assert.equal(thrive.priorityAlerts, false);

  const crave = getPlanLimits("crave");
  assert.equal(crave.priorityAlerts, false);
});

test("Scheduled downgrade execution: applies on 1st of next month, deactivates excess newest first", async () => {
  const { applyScheduledPlanDowngrade } = await import("../lib/plans.ts");

  // 1. Crown to Thrive: products 50 (within 300); staff 12 -> max 10; slots 8 -> unlimited (0 deactivated)
  const crownVendorThriveTarget = {
    id: "v_crown_1",
    businessName: "Royal Biryani Kitchen",
    plan: "Crown",
    scheduledPlanChange: {
      nextPlan: "Thrive",
      effectiveDate: "2026-12-01",
      requestedAt: "2026-11-16T10:00:00Z",
    },
  };

  const prods = Array.from({ length: 50 }, (_, i) => ({
    id: `prod_${i + 1}`,
    vendorId: "v_crown_1",
    active: true,
  }));

  const staff = Array.from({ length: 12 }, (_, i) => ({
    id: `staff_${i + 1}`,
    vendorId: "v_crown_1",
    active: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  const slots = Array.from({ length: 8 }, (_, i) => ({
    id: `slot_${i + 1}`,
    vendorId: "v_crown_1",
    isActive: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  // On Nov 30: not applied
  const beforeDue = applyScheduledPlanDowngrade(crownVendorThriveTarget, prods, staff, slots, new Date("2026-11-30T20:00:00+05:30"));
  assert.equal(beforeDue.applied, false);

  // On Dec 1: applied
  const afterDueThrive = applyScheduledPlanDowngrade(crownVendorThriveTarget, prods, staff, slots, new Date("2026-12-01T01:00:00+05:30"));
  assert.equal(afterDueThrive.applied, true);
  assert.equal(afterDueThrive.newPlan, "Thrive");
  // 50 products is well within Thrive's 300 limit -> 0 deactivated
  assert.equal(afterDueThrive.deactivatedProductIds.length, 0);
  // Thrive allows 10 staff -> 2 newest deactivated (staff_12, staff_11)
  assert.equal(afterDueThrive.deactivatedStaffIds.length, 2);
  assert.deepEqual(afterDueThrive.deactivatedStaffIds, ["staff_12", "staff_11"]);
  // Slots are unlimited on Thrive -> 0 deactivated
  assert.equal(afterDueThrive.deactivatedSlotIds.length, 0);

  // 2. Crown to Crave: products 105 -> max 100; staff 7 -> max 5; slots 5 -> unlimited (0 deactivated)
  const crownVendorCraveTarget = {
    id: "v_crown_2",
    businessName: "Maharaja Foods",
    plan: "Crown",
    scheduledPlanChange: {
      nextPlan: "Crave",
      effectiveDate: "2026-12-01",
      requestedAt: "2026-11-16T10:00:00Z",
    },
  };

  const prods105 = Array.from({ length: 105 }, (_, i) => ({
    id: `prod_c_${i + 1}`,
    vendorId: "v_crown_2",
    active: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  const staff7 = Array.from({ length: 7 }, (_, i) => ({
    id: `stf_c_${i + 1}`,
    vendorId: "v_crown_2",
    active: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  const slots5 = Array.from({ length: 5 }, (_, i) => ({
    id: `slt_c_${i + 1}`,
    vendorId: "v_crown_2",
    isActive: true,
    createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

  const afterDueCrave = applyScheduledPlanDowngrade(crownVendorCraveTarget, prods105, staff7, slots5, new Date("2026-12-01T01:00:00+05:30"));
  assert.equal(afterDueCrave.applied, true);
  assert.equal(afterDueCrave.newPlan, "Crave");
  // Crave allows 100 products -> 5 newest deactivated
  assert.equal(afterDueCrave.deactivatedProductIds.length, 5);
  assert.deepEqual(afterDueCrave.deactivatedProductIds, ["prod_c_105", "prod_c_104", "prod_c_103", "prod_c_102", "prod_c_101"]);
  // Crave allows 5 staff -> 2 newest deactivated (stf_c_7, stf_c_6)
  assert.equal(afterDueCrave.deactivatedStaffIds.length, 2);
  assert.deepEqual(afterDueCrave.deactivatedStaffIds, ["stf_c_7", "stf_c_6"]);
  // Slots are unlimited on Crave -> 0 deactivated
  assert.equal(afterDueCrave.deactivatedSlotIds.length, 0);
});

test("Customer module vs Vendor dashboard visibility on downgrade", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");

  // In customer quotes: only quotes from vendors on Crown plan are displayed
  assert.match(ui, /x\.vendorId\)\?\.plan === "Crown"/);

  // In vendor quotes: vendor quotation history remains visible even if downgraded
  assert.match(ui, /Your Quotation History/);
  assert.match(ui, /Quotation requests \(RFQ\) and new quote opportunities are exclusive to the Crown plan/);

  // In customer discover: Food Drops show for vendors whose plan allows Food Drops (Crave, Thrive and Crown)
  const customerDiscover = await readFile(path.join(root, "components/customer-v2/discover.tsx"), "utf8");
  assert.match(customerDiscover, /!canCreateFoodDrop\(v\.plan\)\.allowed/);

  // Kitchen Profile QR code
  assert.match(ui, /id="vendor-store-qr"/);
  assert.match(ui, /View Store QR Code/);
});
