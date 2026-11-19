import test from "node:test";
import assert from "node:assert/strict";
import {
  createVendorPlanAuditEvent,
  classifyAuditCategory,
  extractAuditChanges,
} from "../lib/audit-trail.ts";

test("Vendor Plan Audit Trail - Comprehensive Test Suite", async (t) => {
  // Scenario 1: Admin changes vendor plan from Crave to Crown
  await t.test("1. Admin changes vendor plan from Crave to Crown", () => {
    const auditEvent = createVendorPlanAuditEvent({
      actorName: "Ananya Admin",
      actorEmail: "ananya@sheplates.com",
      actorRole: "Admin",
      vendorId: "v-kitchen-01",
      vendorName: "Amma Kitchen",
      previousPlan: "Crave",
      newPlan: "Crown",
      previousPrice: 699,
      newPrice: 999,
      previousStatus: "Active",
      newStatus: "Active",
      reason: "Requested upgrade to Crown plan for RFQ & quotation access",
    });

    assert.equal(auditEvent.action, "Vendor Plan Updated");
    assert.equal(auditEvent.actorName, "Ananya Admin");
    assert.equal(auditEvent.actorEmail, "ananya@sheplates.com");
    assert.equal(auditEvent.actorRole, "Admin");
    assert.equal(auditEvent.vendorName, "Amma Kitchen");
    assert.equal(auditEvent.entityId, "v-kitchen-01");
    assert.equal(auditEvent.category, "Plans and pricing");

    // Check before & after data
    assert.equal(auditEvent.beforeData?.plan, "crave");
    assert.equal(auditEvent.beforeData?.formattedPrice, "₹699/month");
    assert.equal(auditEvent.afterData?.plan, "crown");
    assert.equal(auditEvent.afterData?.formattedPrice, "₹999/month");
    assert.equal(auditEvent.afterData?.reason, "Requested upgrade to Crown plan for RFQ & quotation access");

    // Check structured changes
    const changes = auditEvent.changes || [];
    const planChange = changes.find((c) => c.field === "Subscription Plan");
    assert.ok(planChange, "Subscription Plan change must be recorded");
    assert.equal(planChange.previousValue, "Crave");
    assert.equal(planChange.newValue, "Crown");

    const priceChange = changes.find((c) => c.field === "Plan Price");
    assert.ok(priceChange, "Plan Price change must be recorded");
    assert.equal(priceChange.previousValue, "₹699/month");
    assert.equal(priceChange.newValue, "₹999/month");
  });

  // Scenario 2: Super Admin changes vendor plan
  await t.test("2. Super Admin changes vendor plan", () => {
    const auditEvent = createVendorPlanAuditEvent({
      actorName: "Vikram Super",
      actorEmail: "vikram.super@sheplates.com",
      actorRole: "Super Admin",
      vendorId: "v-kitchen-02",
      vendorName: "Chettinad Spices",
      previousPlan: "Taster",
      newPlan: "Thrive",
      previousPrice: 499,
      newPrice: 799,
      reason: "Super Admin direct upgrade",
    });

    assert.equal(auditEvent.actorRole, "Super Admin");
    assert.equal(auditEvent.actorName, "Vikram Super");
    assert.ok(auditEvent.actor.includes("Super Admin"));
    assert.equal(auditEvent.afterData?.plan, "thrive");
    assert.equal(auditEvent.afterData?.actorRole, "Super Admin");
  });

  // Scenario 3: Plan price change is recorded accurately
  await t.test("3. Plan price change is recorded accurately for all plan tiers", () => {
    const plans = [
      { name: "Taster", price: 499 },
      { name: "Crave", price: 699 },
      { name: "Thrive", price: 799 },
      { name: "Crown", price: 999 },
    ];

    for (let i = 0; i < plans.length - 1; i++) {
      const prev = plans[i];
      const next = plans[i + 1];

      const event = createVendorPlanAuditEvent({
        actorName: "Admin",
        actorRole: "Admin",
        vendorId: "v-test",
        vendorName: "Test Kitchen",
        previousPlan: prev.name,
        newPlan: next.name,
        previousPrice: prev.price,
        newPrice: next.price,
      });

      assert.equal(event.beforeData?.monthlyPrice, prev.price);
      assert.equal(event.afterData?.monthlyPrice, next.price);
      assert.equal(event.beforeData?.formattedPrice, `₹${prev.price}/month`);
      assert.equal(event.afterData?.formattedPrice, `₹${next.price}/month`);
    }
  });

  // Scenario 4: Plan update failure simulation
  await t.test("4. Plan update failure - no audit log entry produced on failure", () => {
    const initialAuditCount = 3;
    let auditList = [
      { id: "aud-1", action: "User login", detail: "Admin logged in", at: "2026-11-18 10:00" },
      { id: "aud-2", action: "Vendor verification", detail: "FSSAI verified", at: "2026-11-18 10:15" },
      { id: "aud-3", action: "Pricing change", detail: "Updated markup", at: "2026-11-18 10:30" },
    ];

    // Simulate update failure handler in UI / API:
    // When DB update fails, any optimistic audit entry is rolled back
    const pendingAuditEvent = createVendorPlanAuditEvent({
      actorName: "Admin",
      actorRole: "Admin",
      vendorId: "v-fail",
      vendorName: "Failing Kitchen",
      previousPlan: "Crave",
      newPlan: "Crown",
      previousPrice: 699,
      newPrice: 999,
    });

    let currentVendorPlan = "Crave";
    const oldPlan = currentVendorPlan;

    // Simulate error during backend save
    let saveFailed = true;
    try {
      if (saveFailed) {
        throw new Error("Database transaction aborted: lock timeout");
      }
      currentVendorPlan = "Crown";
      auditList = [pendingAuditEvent, ...auditList];
    } catch (_err) {
      // Revert action (matching components/sheplates-v3.tsx error handler)
      currentVendorPlan = oldPlan;
      auditList = auditList.filter((a) => a.id !== pendingAuditEvent.id);
    }

    assert.equal(currentVendorPlan, "Crave", "Vendor plan should remain unchanged");
    assert.equal(auditList.length, initialAuditCount, "No new audit entry should be added to the trail");
    assert.ok(!auditList.some((a) => a.id === pendingAuditEvent.id), "Pending audit event must be discarded");
  });

  // Scenario 5: Multiple vendors plan changes
  await t.test("5. Multiple vendors plan changes create distinct audit entries", () => {
    const event1 = createVendorPlanAuditEvent({
      id: "aud-v1",
      actorName: "Admin User",
      actorRole: "Admin",
      vendorId: "vendor-alpha",
      vendorName: "Alpha Kitchen",
      previousPlan: "Taster",
      newPlan: "Crave",
      previousPrice: 499,
      newPrice: 699,
    });

    const event2 = createVendorPlanAuditEvent({
      id: "aud-v2",
      actorName: "Admin User",
      actorRole: "Admin",
      vendorId: "vendor-beta",
      vendorName: "Beta Kitchen",
      previousPlan: "Thrive",
      newPlan: "Crown",
      previousPrice: 799,
      newPrice: 999,
    });

    assert.notEqual(event1.id, event2.id);
    assert.equal(event1.vendorName, "Alpha Kitchen");
    assert.equal(event1.entityId, "vendor-alpha");
    assert.equal(event2.vendorName, "Beta Kitchen");
    assert.equal(event2.entityId, "vendor-beta");
    assert.equal(event1.afterData?.plan, "crave");
    assert.equal(event2.afterData?.plan, "crown");
  });

  // Scenario 6: Historical audit records compatibility
  await t.test("6. Existing historical audit records remain valid and categorized", () => {
    const legacyRecords = [
      { id: "leg-1", actor: "Ops Team", action: "Vendor verification approved", detail: "FSSAI certificate approved for ID v-101", at: "12 Nov 2026, 10:00 am" },
      { id: "leg-2", actor: "Super Admin", action: "Created team user", detail: "Created operations user ops@sheplates.com", at: "13 Nov 2026, 02:30 pm" },
      { id: "leg-3", actor: "Ananya", action: "Pricing change: item markup", detail: "Markup updated to 12% on Pepper Rasam", at: "14 Nov 2026, 04:15 pm" },
      { id: "leg-4", actor: "System", action: "User permission granted", detail: "Granted p0_permission to vendor@test.com", at: "15 Nov 2026, 09:00 am" },
    ];

    assert.equal(classifyAuditCategory(legacyRecords[0].action, "", legacyRecords[0].detail), "Vendor verification");
    assert.equal(classifyAuditCategory(legacyRecords[1].action, "", legacyRecords[1].detail), "Team user management");
    assert.equal(classifyAuditCategory(legacyRecords[2].action, "", legacyRecords[2].detail), "Plans and pricing");
    assert.equal(classifyAuditCategory(legacyRecords[3].action, "", legacyRecords[3].detail), "Permissions");

    // Generic diff returns empty without error on legacy record
    const changes = extractAuditChanges(legacyRecords[0].action, null, null);
    assert.deepEqual(changes, []);
  });

  // Scenario 7: Expanded details formatting and overflow protection
  await t.test("7. Expanded details display and metadata integrity", () => {
    const longUUID = "123e4567-e89b-12d3-a456-426614174000-very-long-unique-identifier";
    const longEmail = "super.administrator.with.extremely.long.email.address@sheplates.fooddelivery.internal.com";

    const event = createVendorPlanAuditEvent({
      actorName: "Super Admin",
      actorEmail: longEmail,
      actorRole: "Super Admin",
      vendorId: longUUID,
      vendorName: "Grand Homely Kitchens with Long Name Pvt Ltd",
      previousPlan: "Crave",
      newPlan: "Crown",
      previousPrice: "₹699/month",
      newPrice: "₹999/month",
      previousStatus: "Operational",
      newStatus: "Operational",
      reason: "Commercial agreement signed for Crown plan with quarterly billing cycle",
    });

    assert.equal(event.entityId, longUUID);
    assert.equal(event.actorEmail, longEmail);
    assert.ok(event.detail.includes("Grand Homely Kitchens"));

    // Extract changes
    const changes = extractAuditChanges("Vendor Plan Updated", event.beforeData, event.afterData);
    assert.equal(changes.length, 3);
    assert.equal(changes[0].field, "Subscription Plan");
    assert.equal(changes[0].previousValue, "Crave");
    assert.equal(changes[0].newValue, "Crown");
  });

  // Scenario 8: Filter and search logic
  await t.test("8. Filter and search matching logic", () => {
    const events = [
      createVendorPlanAuditEvent({
        actorName: "Ananya",
        actorEmail: "ananya@sheplates.com",
        actorRole: "Admin",
        vendorId: "v-1",
        vendorName: "Madurai Mess",
        previousPlan: "Taster",
        newPlan: "Crave",
        previousPrice: 499,
        newPrice: 699,
        at: "16 Nov 2026, 11:00 am",
      }),
      createVendorPlanAuditEvent({
        actorName: "Vikram",
        actorEmail: "vikram@sheplates.com",
        actorRole: "Super Admin",
        vendorId: "v-2",
        vendorName: "Salem Delights",
        previousPlan: "Crave",
        newPlan: "Crown",
        previousPrice: 699,
        newPrice: 999,
        at: "17 Nov 2026, 03:00 pm",
      }),
    ];

    // Filter by category
    const plansEvents = events.filter((e) => (e.category || classifyAuditCategory(e.action, e.detail)) === "Plans and pricing");
    assert.equal(plansEvents.length, 2);

    // Filter by Actor
    const ananyaEvents = events.filter((e) => e.actorName === "Ananya");
    assert.equal(ananyaEvents.length, 1);
    assert.equal(ananyaEvents[0].vendorName, "Madurai Mess");

    // Filter by Vendor
    const salemEvents = events.filter((e) => e.vendorName === "Salem Delights");
    assert.equal(salemEvents.length, 1);
    assert.equal(salemEvents[0].actorName, "Vikram");

    // Search query matching
    const query = "salem";
    const searchResults = events.filter((e) =>
      `${e.actor} ${e.actorName} ${e.action} ${e.detail} ${e.vendorName}`.toLowerCase().includes(query.toLowerCase())
    );
    assert.equal(searchResults.length, 1);
    assert.equal(searchResults[0].vendorName, "Salem Delights");
  });

  // Scenario 9: Duplicate plan selection prevention
  await t.test("9. Duplicate plan selection does not generate audit events", () => {
    let auditList = [];
    const currentVendor = { id: "v-dup", businessName: "Duplicate Test Kitchen", plan: "Crown" };

    function onSelectPlan(selectedPlan) {
      if (selectedPlan === currentVendor.plan) {
        // Ignored: do not add duplicate audit event or make API call
        return;
      }

      const event = createVendorPlanAuditEvent({
        actorName: "Admin",
        actorRole: "Admin",
        vendorId: currentVendor.id,
        vendorName: currentVendor.businessName,
        previousPlan: currentVendor.plan,
        newPlan: selectedPlan,
        previousPrice: 999,
        newPrice: 799,
      });
      auditList.push(event);
      currentVendor.plan = selectedPlan;
    }

    // Select Crown while already on Crown
    onSelectPlan("Crown");
    assert.equal(auditList.length, 0, "No audit event should be created when selecting the current plan");

    // Select Thrive (different plan)
    onSelectPlan("Thrive");
    assert.equal(auditList.length, 1, "Exactly one audit event created on legitimate plan change");
    assert.equal(currentVendor.plan, "Thrive");

    // Select Thrive again
    onSelectPlan("Thrive");
    assert.equal(auditList.length, 1, "No additional audit event created when re-selecting Thrive");
  });
});
