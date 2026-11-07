import assert from "node:assert/strict";
import test from "node:test";
import { priceDeliveries, loadPlanContext, planPricing, dayLabel } from "../lib/menu-pricing.ts";
import { dayPrice, validateDayPrice, withMarkup } from "../lib/weekly-menu.ts";

const cells = [
  { weekday: "Mon", price: 100, dishes: ["Idli", "Sambar"], open: true },
  { weekday: "Tue", price: 150, dishes: ["Chapati", "Dal"], open: true },
  { weekday: "Wed", price: null, dishes: ["Rice"], open: true },
  { weekday: "Thu", price: 90, dishes: ["Pongal"], open: false },
  { weekday: "Fri", price: 120, dishes: [], open: true },
];
const ctx = { meal: "lunch", diet: "veg", cells, fallbackBase: 80 };
// 2026-11-09 is a Monday
const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"];

test("every day is priced on its own, with the plan's lowest price as the fallback", () => {
  const { days, skipped } = priceDeliveries(week, ctx, "Veg lunch plan", 0);
  assert.deepEqual(days.map((d) => [d.weekday, d.baseUnit]), [["Mon", 100], ["Tue", 150], ["Wed", 80]]);
  assert.deepEqual(skipped, ["2026-11-12", "2026-11-13", "2026-11-14"], "off, empty and unlisted days are never sold");
});

test("Sheplates' markup is applied to each day's price, and the label carries the dishes the customer was promised", () => {
  const { days } = priceDeliveries(["2026-11-10"], ctx, "Veg lunch plan", 10);
  assert.equal(days[0].customerUnit, 165);
  assert.equal(days[0].label, "Veg lunch plan · Tue: Chapati, Dal");
  assert.equal(dayLabel("Plan", "Mon", ["x".repeat(300)]).length, 220);
  assert.equal(withMarkup(99.99, 12.5), 112.49);
  assert.equal(withMarkup(100, -50), 100, "a markup never lowers the price");
});

test("helpers: day price fallback and validation", () => {
  assert.equal(dayPrice({ price: 120 }, 80), 120); assert.equal(dayPrice({ price: null }, 80), 80); assert.equal(dayPrice(undefined, 80), 80);
  for (const bad of [0, 9.99, 5001, NaN]) assert.ok(validateDayPrice(bad), String(bad));
  assert.equal(validateDayPrice(10), null);
});

function fakeAdmin({ days, markup = 0, failPrice = false, tableMissing = false }) {
  const q = (table, columns) => {
    const b = { eq: () => b, maybeSingle: async () => ({ data: table === "vendor_item_markups" ? { markup_percent: markup } : null, error: null }),
      then: (res) => Promise.resolve(table === "home_menu_days" ? (tableMissing ? { data: null, error: { message: "relation home_menu_days does not exist" } } : failPrice && columns.includes("price") ? { data: null, error: { message: "column price does not exist" } } : { data: days.map((d) => columns.includes("price") ? d : { weekday: d.weekday, dishes: d.dishes, is_open: d.is_open }), error: null }) : { data: [], error: null }).then(res) };
    return b;
  };
  return { from: (t) => ({ select: (c) => q(t, c) }) };
}
const rows = [{ weekday: "Mon", dishes: ["Idli"], is_open: true, price: 100 }, { weekday: "Tue", dishes: ["Dal"], is_open: true, price: 150 }];

test("a subscription is priced on the server as the sum of its days", async () => {
  const admin = fakeAdmin({ days: rows, markup: 10 });
  const r = await planPricing(admin, { menuItemId: "m1", vendorId: "v1", name: "Veg lunch plan", basePrice: 100, quantity: 2, dates: ["2026-11-09", "2026-11-10", "2026-11-11"] });
  assert.deepEqual(r.days.map((d) => d.customerTotal), [220, 330]);
  assert.equal(r.total, 550);
  assert.deepEqual(r.skipped, ["2026-11-11"]);
});

test("not a plan, no menu, or a database that has no weekly menu yet: sold at the ordinary flat price", async () => {
  assert.equal(await planPricing(fakeAdmin({ days: rows }), { menuItemId: "m", vendorId: "v", name: "Butter chicken", basePrice: 200, quantity: 1, dates: ["2026-11-09"] }), null);
  assert.equal(await planPricing(fakeAdmin({ days: [] }), { menuItemId: "m", vendorId: "v", name: "Veg lunch plan", basePrice: 100, quantity: 1, dates: ["2026-11-09"] }), null);
  assert.equal(await loadPlanContext(fakeAdmin({ days: rows, tableMissing: true }), "v", "Veg lunch plan", 100), null);
});

test("before the day-price column exists, every day sells at the plan's price", async () => {
  const c = await loadPlanContext(fakeAdmin({ days: rows, failPrice: true }), "v", "Veg lunch plan", 100);
  assert.deepEqual(c.cells.map((x) => x.price), [null, null]);
  assert.equal(priceDeliveries(["2026-11-10"], c, "Veg lunch plan", 0).days[0].baseUnit, 100);
});
