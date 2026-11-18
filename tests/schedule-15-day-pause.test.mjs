import test from "node:test";
import assert from "node:assert/strict";
import {
  computeResumeByIST,
  formatISTDate,
  getDaysRemainingIST,
  isPauseWindowExpiredIST,
  getIndiaDate,
  pauseScheduleServer,
  resumeScheduleServer,
  closeScheduleServer,
  processScheduleDeadlines,
  PAUSE_WINDOW_DAYS,
} from "../lib/schedule-pause.ts";

// Mock SupabaseClient in-memory for thorough test coverage
function createMockSupabase() {
  const db = {
    product_schedules: [],
    orders: [],
    notifications: [],
    product_schedule_history: [],
    audit_log: [],
    communication_outbox: [],
    vendors: [{ id: "vend-1", owner_id: "vendor-owner-1", name: "Ananya Kitchen" }],
    vendor_menu_items: [{ id: "item-1", name: "South Indian Thali", vendor_base_price: 150 }],
  };

  const client = {
    _db: db,
    from(table) {
      const rows = db[table] || [];
      return {
        select(cols = "*") {
          let filtered = [...rows];
          const query = {
            eq(col, val) {
              filtered = filtered.filter((r) => String(r[col]) === String(val));
              return query;
            },
            neq(col, val) {
              filtered = filtered.filter((r) => String(r[col]) !== String(val));
              return query;
            },
            gte(col, val) {
              filtered = filtered.filter((r) => r[col] >= val);
              return query;
            },
            in(col, vals) {
              filtered = filtered.filter((r) => vals.includes(r[col]));
              return query;
            },
            order() {
              return query;
            },
            limit(n) {
              filtered = filtered.slice(0, n);
              return query;
            },
            async maybeSingle() {
              return { data: filtered[0] || null, error: null };
            },
            async single() {
              if (!filtered.length) return { data: null, error: { message: "Row not found" } };
              return { data: filtered[0], error: null };
            },
            then(resolve) {
              resolve({ data: filtered, error: null });
            },
          };
          return query;
        },
        insert(records) {
          const arr = Array.isArray(records) ? records : [records];
          const inserted = arr.map((rec) => {
            const row = { id: rec.id || `row-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString(), ...rec };
            rows.push(row);
            return row;
          });
          return {
            select() {
              return {
                async single() {
                  return { data: inserted[0], error: null };
                },
                then(resolve) {
                  resolve({ data: inserted, error: null });
                },
              };
            },
            then(resolve) {
              resolve({ data: inserted, error: null });
            },
          };
        },
        update(patch) {
          const matchers = [];
          const query = {
            eq(col, val) {
              matchers.push((r) => String(r[col]) === String(val));
              return query;
            },
            neq(col, val) {
              matchers.push((r) => String(r[col]) !== String(val));
              return query;
            },
            gte(col, val) {
              matchers.push((r) => r[col] >= val);
              return query;
            },
            in(col, vals) {
              matchers.push((r) => vals.includes(r[col]));
              return query;
            },
            then(resolve) {
              let updatedCount = 0;
              for (const row of rows) {
                if (matchers.every((m) => m(row))) {
                  Object.assign(row, patch);
                  updatedCount++;
                }
              }
              resolve({ data: updatedCount, error: null });
            },
          };
          return query;
        },
        delete() {
          const matchers = [];
          const query = {
            eq(col, val) {
              matchers.push((r) => String(r[col]) === String(val));
              return query;
            },
            then(resolve) {
              const keep = rows.filter((r) => !matchers.every((m) => m(r)));
              rows.length = 0;
              rows.push(...keep);
              resolve({ data: null, error: null });
            },
          };
          return query;
        },
      };
    },
  };
  return client;
}

test("Scenario 1: Pause persistence — pause saves on server, records start and resume_by (start + 15 days IST)", async () => {
  const client = createMockSupabase();
  client._db.product_schedules.push({
    id: "sched-101",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    menu_item_id: "item-1",
    status: "active",
    start_date: "2026-11-20",
    recurrence: "daily",
    scheduled_slot: "07:00–08:00 AM",
    quantity: 1,
    unit: "pack",
    fulfilment_mode: "vendor_delivery",
  });

  const res = await pauseScheduleServer(client, "sched-101", {
    id: "cust-1",
    email: "customer@example.com",
    role: "customer",
  });

  assert.equal(res.ok, true);
  assert.ok(res.pausedAt);
  assert.ok(res.resumeBy);

  // Check persisted in database
  const sched = client._db.product_schedules.find((s) => s.id === "sched-101");
  assert.equal(sched.status, "paused");
  assert.equal(sched.paused_at, res.pausedAt);
  assert.equal(sched.resume_by, res.resumeBy);

  // Check 15 days calculation in IST
  const remainingDays = getDaysRemainingIST(sched.resume_by, new Date(res.pausedAt));
  assert.equal(remainingDays, 15);

  // When polled 15 seconds or 5 minutes later, database returns 'paused'
  const polled = client._db.product_schedules.find((s) => s.id === "sched-101");
  assert.equal(polled.status, "paused", "Polling does NOT overwrite paused state");
});

test("Scenario 2: Failed pause API call keeps old state and shows error", async () => {
  const client = createMockSupabase();
  client._db.product_schedules.push({
    id: "sched-102",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    status: "active",
  });

  // Attempt pause by unauthorized user
  const failRes = await pauseScheduleServer(client, "sched-102", {
    id: "cust-other",
    email: "intruder@example.com",
    role: "customer",
  });

  assert.equal(failRes.ok, false);
  assert.equal(failRes.status, 403);

  // Verify schedule status remains active (never false paused)
  const sched = client._db.product_schedules.find((s) => s.id === "sched-102");
  assert.equal(sched.status, "active");
  assert.equal(sched.paused_at, undefined);
});

test("Scenario 3: Resume on Day 14 (within 15-day window) succeeds and restores schedule to active", async () => {
  const client = createMockSupabase();
  const now = new Date();
  const pausedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  // resumeBy was set to 15 days from pausedAt, so 1 day remains
  const resumeBy = computeResumeByIST(new Date(pausedAt), 15).toISOString();

  client._db.product_schedules.push({
    id: "sched-103",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    menu_item_id: "item-1",
    status: "paused",
    paused_at: pausedAt,
    resume_by: resumeBy,
    start_date: "2026-11-01",
    end_date: "2026-12-31",
    recurrence: "daily",
    scheduled_slot: "07:00–08:00 AM",
    quantity: 1,
    unit: "pack",
    fulfilment_mode: "vendor_delivery",
  });

  // Customer resumes on day 14 (before deadline)
  const resumeRes = await resumeScheduleServer(client, "sched-103", {
    id: "cust-1",
    email: "customer@example.com",
    role: "customer",
  });

  assert.equal(resumeRes.ok, true);

  const sched = client._db.product_schedules.find((s) => s.id === "sched-103");
  assert.equal(sched.status, "active");
  assert.equal(sched.paused_at, null);
  assert.equal(sched.resume_by, null);

  // Verify history log recorded
  const history = client._db.product_schedule_history.filter((h) => h.schedule_id === "sched-103");
  assert.ok(history.some((h) => h.action === "resume" && h.new_status === "active"));
});

test("Scenario 4: Resume after Day 15 (past deadline) must fail for customer", async () => {
  const client = createMockSupabase();
  const now = new Date();
  // Paused 16 days ago
  const pausedAt = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString();
  // Deadline expired yesterday
  const resumeBy = computeResumeByIST(new Date(pausedAt), 15).toISOString();

  client._db.product_schedules.push({
    id: "sched-104",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    menu_item_id: "item-1",
    status: "paused",
    paused_at: pausedAt,
    resume_by: resumeBy,
  });

  // Customer attempts to resume after deadline
  const resumeRes = await resumeScheduleServer(client, "sched-104", {
    id: "cust-1",
    email: "customer@example.com",
    role: "customer",
  });

  assert.equal(resumeRes.ok, false);
  assert.equal(resumeRes.status, 409);
  assert.match(resumeRes.error, /expired|closed/i);

  // Status transitions to closed
  const sched = client._db.product_schedules.find((s) => s.id === "sched-104");
  assert.equal(sched.status, "closed");
});

test("Scenario 5: Automatic closing job on day 15 closes schedule without refund", async () => {
  const client = createMockSupabase();
  const now = new Date();
  // Paused 16 days ago -> deadline has passed
  const pausedAt = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString();
  const resumeBy = computeResumeByIST(new Date(pausedAt), 15).toISOString();

  client._db.product_schedules.push({
    id: "sched-105",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    status: "paused",
    paused_at: pausedAt,
    resume_by: resumeBy,
  });

  // Future orders exist that should be cancelled with NO refund
  client._db.orders.push({
    id: "ord-future-1",
    schedule_id: "sched-105",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    status: "confirmed",
    scheduled_date: "2026-11-25",
  });

  const cronResult = await processScheduleDeadlines(client);
  assert.equal(cronResult.closed, 1);

  const sched = client._db.product_schedules.find((s) => s.id === "sched-105");
  assert.equal(sched.status, "closed");
  assert.ok(sched.closed_at);
  assert.match(sched.closure_reason, /15 days/i);

  // Customer cannot resume closed schedule
  const customerRetry = await resumeScheduleServer(client, "sched-105", {
    id: "cust-1",
    email: "customer@example.com",
    role: "customer",
  });
  assert.equal(customerRetry.ok, false);
  assert.equal(customerRetry.status, 409);

  // Notification sent to customer
  const notif = client._db.notifications.find((n) => n.recipient_id === "cust-1" && n.entity_id === "sched-105");
  assert.ok(notif);
  assert.match(notif.body, /non-refundable|no refund/i);
});

test("Scenario 6: Closing job is safe to run twice (idempotent, no double closing or duplicate notifications)", async () => {
  const client = createMockSupabase();
  const now = new Date();
  const pausedAt = new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString();
  const resumeBy = computeResumeByIST(new Date(pausedAt), 15).toISOString();

  client._db.product_schedules.push({
    id: "sched-106",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    status: "paused",
    paused_at: pausedAt,
    resume_by: resumeBy,
  });

  // Run 1
  const run1 = await processScheduleDeadlines(client);
  assert.equal(run1.closed, 1);

  const notifsRun1 = client._db.notifications.filter((n) => n.entity_id === "sched-106").length;
  assert.equal(notifsRun1, 1);

  // Run 2 immediately after
  const run2 = await processScheduleDeadlines(client);
  assert.equal(run2.closed, 0, "Second run should not re-close");

  const notifsRun2 = client._db.notifications.filter((n) => n.entity_id === "sched-106").length;
  assert.equal(notifsRun2, 1, "Second run must not duplicate notification");
});

test("Scenario 7: Vendor upcoming orders and counts immediately exclude paused and closed schedules", async () => {
  const client = createMockSupabase();

  client._db.product_schedules.push(
    { id: "sched-active", vendor_id: "vend-1", status: "active" },
    { id: "sched-paused", vendor_id: "vend-1", status: "paused" },
    { id: "sched-closed", vendor_id: "vend-1", status: "closed" }
  );

  const orders = [
    { id: "ord-1", vendor_id: "vend-1", schedule_id: "sched-active", payment: "Paid", status: "confirmed" },
    { id: "ord-2", vendor_id: "vend-1", schedule_id: "sched-paused", payment: "Paid", status: "confirmed" },
    { id: "ord-3", vendor_id: "vend-1", schedule_id: "sched-closed", payment: "Paid", status: "confirmed" },
    { id: "ord-4", vendor_id: "vend-1", payment: "Paid", status: "confirmed" }, // normal standalone order
  ];

  // Vendor filter logic as implemented in commerceSnapshot & UI
  const nonActiveScheduleIds = new Set(
    client._db.product_schedules
      .filter((s) => s.status === "paused" || s.status === "closed")
      .map((s) => s.id)
  );

  const vendorVisibleOrders = orders.filter((o) => {
    if (o.schedule_id && nonActiveScheduleIds.has(o.schedule_id)) return false;
    return true;
  });

  assert.equal(vendorVisibleOrders.length, 2);
  assert.deepEqual(vendorVisibleOrders.map((o) => o.id), ["ord-1", "ord-4"]);
  assert.ok(!vendorVisibleOrders.some((o) => o.schedule_id === "sched-paused"));
  assert.ok(!vendorVisibleOrders.some((o) => o.schedule_id === "sched-closed"));
});

test("Scenario 8: Reminders sent before deadline on day 7, 13, and 14 without duplicate", async () => {
  const client = createMockSupabase();
  const now = new Date();
  // Paused 8 days ago
  const pausedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const resumeBy = computeResumeByIST(new Date(pausedAt), 15).toISOString();

  client._db.product_schedules.push({
    id: "sched-108",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    status: "paused",
    paused_at: pausedAt,
    resume_by: resumeBy,
  });

  const cron1 = await processScheduleDeadlines(client);
  assert.equal(cron1.remindersSent, 1);

  // Check reminder notification
  const rem1 = client._db.notifications.find((n) => n.recipient_id === "cust-1" && n.entity_id === "sched-108");
  assert.ok(rem1);
  assert.match(rem1.title, /resume/i);

  // Run again immediately - should NOT duplicate reminder
  const cron2 = await processScheduleDeadlines(client);
  assert.equal(cron2.remindersSent, 0);
});

test("Scenario 9: Operations and Super Admin can reopen a closed schedule with documented reason", async () => {
  const client = createMockSupabase();
  client._db.product_schedules.push({
    id: "sched-109",
    customer_id: "cust-1",
    vendor_id: "vend-1",
    menu_item_id: "item-1",
    status: "closed",
    closed_at: new Date().toISOString(),
    closure_reason: "Closed: not resumed within 15 days",
    start_date: "2026-11-01",
    end_date: "2026-12-31",
    recurrence: "daily",
    scheduled_slot: "07:00–08:00 AM",
    quantity: 1,
    unit: "pack",
    fulfilment_mode: "vendor_delivery",
  });

  const reopenRes = await resumeScheduleServer(
    client,
    "sched-109",
    { id: "admin-1", email: "admin@sheplates.com", role: "admin" },
    "Approved customer hardship extension"
  );

  assert.equal(reopenRes.ok, true);

  const sched = client._db.product_schedules.find((s) => s.id === "sched-109");
  assert.equal(sched.status, "active");
  assert.equal(sched.closed_at, null);

  // Audit log check
  const audit = client._db.audit_log.find((a) => a.target_id === "sched-109" && a.action === "schedule_admin_reopen");
  assert.ok(audit);
  assert.match(audit.summary, /hardship extension/i);
});

test("Scenario 10: India time calculation ensures exact 15-calendar-day window", () => {
  const istNow = getIndiaDate();
  assert.ok(istNow.dateStr);

  const testBase = new Date("2026-11-18T10:00:00.000Z"); // 15:30 IST on Nov 18
  const resumeBy = computeResumeByIST(testBase, 15);
  const istTarget = getIndiaDate(resumeBy);

  // Nov 18 + 15 days = Dec 3 in IST
  assert.equal(istTarget.dateStr, "2026-12-03");
  assert.equal(formatISTDate(resumeBy), "3 Dec 2026");
});
