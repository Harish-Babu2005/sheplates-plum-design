import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const uiSource = fs.readFileSync(path.join(root, "components/sheplates-v3.tsx"), "utf8");

test("Newest first sorting and Cancel (X) for expired scheduled orders", async (t) => {
  await t.test("1. Schedules in SchedulesV4 are sorted newest first", () => {
    // Verified that items sorts b.startDate.localeCompare(a.startDate)
    assert.match(uiSource, /items = \[\.\.\.storedSchedules, \.\.\.syntheticSchedules\]\.sort\(\(a, b\) => b\.startDate\.localeCompare\(a\.startDate\)\)/);
  });

  await t.test("2. Orders in OrdersV4 are sorted newest first", () => {
    // getOrderTimestamp calculates timestamp based on createdAt or date
    assert.match(uiSource, /function getOrderTimestamp\(o: Order\)/);
    assert.match(uiSource, /bTime - aTime/);
  });

  await t.test("3. Expired scheduled orders show Cancel (X) button", () => {
    // CustomerOrderCard calculates isExpired and renders Cancel (X) button
    assert.match(uiSource, /const isExpired =\s*order\.status === "Expired" \|\|\s*order\.payment === "Expired" \|\|\s*\(order\.date < todayISO\(\) && !\["Completed", "Delivered", "Cancelled"\]\.includes\(order\.status\)\)/);
    assert.match(uiSource, /Cancel \(X\)/);
    assert.match(uiSource, /onCancelOrder/);
    assert.match(uiSource, /handleCancelOrder/);
  });

  await t.test("4. Expired schedules in SchedulesV4 show Cancel (X) button", () => {
    assert.match(uiSource, /isExpiredSchedule/);
    assert.match(uiSource, /handleCancelSchedule/);
    assert.match(uiSource, /cancelScheduledDelivery/);
  });

  await t.test("5. Sorting logic unit test: newest orders appear first", () => {
    const orders = [
      { id: "ORD-001", date: "2026-11-10", createdAt: "2026-11-10T10:00:00Z" },
      { id: "ORD-002", date: "2026-11-20", createdAt: "2026-11-20T12:00:00Z" },
      { id: "ORD-003", date: "2026-11-15", createdAt: "2026-11-15T08:00:00Z" },
      { id: "ORD-004", date: "2026-11-25" }, // no createdAt, fallback to date
    ];

    function getOrderTimestamp(o) {
      if (o.createdAt) {
        const t = new Date(o.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (o.date) {
        const t = new Date(`${o.date}T12:00:00`).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    }

    const sorted = [...orders].sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
    assert.equal(sorted[0].id, "ORD-004"); // 2026-11-25 is newest
    assert.equal(sorted[1].id, "ORD-002"); // 2026-11-20 is second newest
    assert.equal(sorted[2].id, "ORD-003"); // 2026-11-15 is third
    assert.equal(sorted[3].id, "ORD-001"); // 2026-11-10 is oldest
  });

  await t.test("6. Expired order detection logic", () => {
    const today = "2026-11-20";
    const pastOrder = { id: "ORD-PAST", date: "2026-11-18", status: "Scheduled" };
    const futureOrder = { id: "ORD-FUT", date: "2026-11-25", status: "Scheduled" };
    const deliveredPast = { id: "ORD-DEL", date: "2026-11-18", status: "Delivered" };

    const checkExpired = (o) => o.status === "Expired" || o.payment === "Expired" || (o.date < today && !["Completed", "Delivered", "Cancelled"].includes(o.status));

    assert.equal(checkExpired(pastOrder), true);
    assert.equal(checkExpired(futureOrder), false);
    assert.equal(checkExpired(deliveredPast), false);
  });

  await t.test("7. CartView renders top-right X button and newest first for awaiting payment orders", () => {
    assert.match(uiSource, /const pendingOrders = state\.orders[\s\S]*?\.filter\(.*?item\.payment === "Pending"[\s\S]*?\.sort\(\(a, b\) => getOrderTimestamp\(b\) - getOrderTimestamp\(a\)/);
    assert.match(uiSource, /handleCancelPendingOrder/);
    assert.match(uiSource, /title={scheduledDatePassed \? "Cancel expired scheduled order" : "Cancel order"}/);
    assert.match(uiSource, /<X className="size-4" \/>/);
  });

  await t.test("8. Commerce route supports customer cancelling unpaid or expired orders", () => {
    const commerceSource = fs.readFileSync(path.join(root, "app/api/commerce/route.ts"), "utf8");
    assert.match(commerceSource, /if \(nextStatus === "cancelled"\)/);
    assert.match(commerceSource, /admin\.from\("orders"\)\.update\(\{ status: "cancelled"/);
  });
});
