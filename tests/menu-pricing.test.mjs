import assert from "node:assert/strict";
import test from "node:test";
import { priceDeliveries, loadPlanContext, dayLabel } from "../lib/menu-pricing.ts";
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

// A small in-memory stand-in for the database: tables of rows, select / eq / maybeSingle, and a way to make a column "missing".
export function fakeDb(tables, { missingColumns = {} } = {}) {
  return { from: (name) => ({ select: (cols = "*") => {
    const filters = [];
    const run = () => {
      const bad = (missingColumns[name] || []).find((c) => String(cols).split(",").map((x) => x.trim()).includes(c));
      if (bad) return { data: null, error: { message: `column ${name}.${bad} does not exist` } };
      if (!tables[name]) return { data: null, error: { message: `relation ${name} does not exist` } };
      const rows = tables[name].filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: rows.map((r) => (cols === "*" ? r : Object.fromEntries(String(cols).split(",").map((c) => c.trim()).filter((c) => c in r).map((c) => [c, r[c]])))), error: null };
    };
    const b = { eq: (c, v) => (filters.push([c, v]), b), limit: () => b, maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; }, then: (res, rej) => Promise.resolve(run()).then(res, rej) };
    return b;
  } }) };
}
const rows = [{ vendor_id: "v1", meal: "lunch", diet: "veg", weekday: "Mon", dishes: ["Idli"], is_open: true, price: 100 }, { vendor_id: "v1", meal: "lunch", diet: "veg", weekday: "Tue", dishes: ["Dal"], is_open: true, price: 150 }];

test("not a plan, no menu, or no weekly-menu table yet: sold at the ordinary flat price", async () => {
  assert.equal(await loadPlanContext(fakeDb({ home_menu_days: rows }), "v1", "Butter chicken", 200), null);
  assert.equal(await loadPlanContext(fakeDb({ home_menu_days: [] }), "v1", "Veg lunch plan", 100), null);
  assert.equal(await loadPlanContext(fakeDb({}), "v1", "Veg lunch plan", 100), null);
});

test("before the day-price column exists, every day sells at the plan's price", async () => {
  const c = await loadPlanContext(fakeDb({ home_menu_days: rows }, { missingColumns: { home_menu_days: ["price"] } }), "v1", "Veg lunch plan", 100);
  assert.deepEqual(c.cells.map((x) => x.price), [null, null]);
  assert.equal(priceDeliveries(["2026-11-10"], c, "Veg lunch plan", 0).days[0].baseUnit, 100);
});
