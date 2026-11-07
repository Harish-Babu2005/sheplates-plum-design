import assert from "node:assert/strict";
import test from "node:test";
import { planName, parsePlanName, normalizeDishes, cellFor, isOrderable, orderableDays, plansOffered, weekdayOfDate, nextDateForWeekday, planChoice, validateCell, validatePlanPrice, MAX_DISHES, WEEKDAYS } from "../lib/weekly-menu.ts";

const menus = [
  { vendorId: "v1", weekday: "Mon", meal: "lunch", diet: "veg", dishes: ["Rice", "Sambar"], open: true },
  { vendorId: "v1", weekday: "Wed", meal: "lunch", diet: "veg", dishes: ["Chapati", "Dal"], open: true },
  { vendorId: "v1", weekday: "Fri", meal: "lunch", diet: "veg", dishes: ["Pulao"], open: false },
  { vendorId: "v1", weekday: "Tue", meal: "dinner", diet: "non_veg", dishes: [], open: true },
  { vendorId: "v1", weekday: "Sat", meal: "dinner", diet: "non_veg", dishes: ["Chicken curry"], open: true },
  { vendorId: "v2", weekday: "Mon", meal: "lunch", diet: "veg", dishes: ["Other vendor"], open: true },
];

test("plan names are built one way and read back", () => {
  assert.equal(planName("lunch", "veg"), "Veg lunch plan");
  assert.equal(planName("breakfast", "non_veg"), "Non-veg breakfast plan");
  assert.deepEqual(parsePlanName("  veg LUNCH plan "), { meal: "lunch", diet: "veg" });
  assert.equal(parsePlanName("Butter chicken"), null);
});

test("dishes: one per line or comma, tidy, no repeats, capped", () => {
  assert.deepEqual(normalizeDishes("Rice\n\n  Sambar  ,Rice, Papad"), ["Rice", "Sambar", "Papad"]);
  assert.equal(normalizeDishes(Array.from({ length: 30 }, (_, i) => `Dish ${i}`)).length, MAX_DISHES);
  assert.equal(normalizeDishes("x".repeat(200))[0].length, 60);
  assert.deepEqual(normalizeDishes(""), []);
});

test("a day is orderable only when open with at least one dish; vendors never see each other's cells", () => {
  assert.equal(isOrderable(cellFor(menus, "v1", "Mon", "lunch", "veg")), true);
  assert.equal(isOrderable(cellFor(menus, "v1", "Fri", "lunch", "veg")), false, "switched off");
  assert.equal(isOrderable(cellFor(menus, "v1", "Tue", "dinner", "non_veg")), false, "open but empty");
  assert.equal(isOrderable(undefined), false);
  assert.deepEqual(orderableDays(menus, "v1", "lunch", "veg"), ["Mon", "Wed"]);
  assert.deepEqual(orderableDays(menus, "v2", "lunch", "veg"), ["Mon"]);
  assert.deepEqual(plansOffered(menus, "v1"), [{ meal: "lunch", diet: "veg" }, { meal: "dinner", diet: "non_veg" }]);
});

test("dates: weekday of a date, and the next matching day never goes before tomorrow", () => {
  assert.equal(weekdayOfDate("2026-11-09"), "Mon");
  assert.equal(weekdayOfDate("2026-11-15"), "Sun");
  // today is Sunday 8 Nov 2026, so tomorrow is Monday 9 Nov
  assert.equal(nextDateForWeekday("Mon", "2026-11-09"), "2026-11-09");
  assert.equal(nextDateForWeekday("Sun", "2026-11-09"), "2026-11-15");
  assert.equal(nextDateForWeekday("Wed", "2026-11-09"), "2026-11-11");
  for (const day of WEEKDAYS) { const d = nextDateForWeekday(day, "2026-11-09"); assert.equal(weekdayOfDate(d), day); assert.ok(d >= "2026-11-09" && d <= "2026-11-15"); }
});

test("single day, one weekday every week, and the whole week turn into the right schedule", () => {
  assert.deepEqual(planChoice("single_day", "Wed", ["Mon", "Wed"], "2026-11-09"), { startDate: "2026-11-11", recurrence: "Once", weekdays: [] });
  assert.deepEqual(planChoice("weekly_day", "Wed", ["Mon", "Wed"], "2026-11-09"), { startDate: "2026-11-11", recurrence: "Weekly", weekdays: ["Wed"] });
  assert.deepEqual(planChoice("whole_week", "Wed", ["Wed", "Mon"], "2026-11-10"), { startDate: "2026-11-11", recurrence: "Custom", weekdays: ["Wed", "Mon"] }, "starts at the earliest open day from tomorrow (Tuesday)");
  assert.equal(planChoice("whole_week", "Wed", [], "2026-11-10").weekdays[0], "Wed", "never an empty week");
});

test("validation", () => {
  assert.match(validateCell({ dishes: [], open: true }), /at least one dish/);
  assert.equal(validateCell({ dishes: [], open: false }), null);
  assert.equal(validateCell({ dishes: ["Rice"], open: true }), null);
  for (const bad of [0, 9, 5001, NaN, -5]) assert.ok(validatePlanPrice(bad), String(bad));
  for (const ok of [10, 120, 5000]) assert.equal(validatePlanPrice(ok), null);
});
