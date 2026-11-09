import assert from "node:assert/strict";
import test from "node:test";
import { priceSchedule, orderTotals, missingColumn } from "../lib/schedule-billing.ts";
import { fakeDb } from "./menu-pricing.test.mjs";

const store = { latitude: 11.0183, longitude: 76.9725 };
const north = (km) => ({ latitude: store.latitude + km / 111.19492664, longitude: store.longitude });
const dates6 = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
function world({ category = "Groceries", gstMode, plan = "crave", customer = north(3), markup = 0, menu = [], override = null } = {}) {
  return fakeDb({
    vendors: [{ id: "v1", category, latitude: store.latitude, longitude: store.longitude, service_radius_km: 8, plan_id: "p1", gst_mode: gstMode ?? null, delivery_fee_override: override }],
    vendor_plans: [{ id: "p1", code: plan }], vendor_commercial_terms: [], vendor_item_markups: markup ? [{ menu_item_id: "m1", markup_percent: markup }] : [],
    customer_preferences: [{ customer_id: "c1", latitude: customer.latitude, longitude: customer.longitude }], home_menu_days: menu,
  });
}
const item = { id: "m1", name: "Sugar", vendor_base_price: 50 };
const price = (admin, extra = {}) => priceSchedule(admin, { customerId: "c1", vendorId: "v1", menuItem: item, quantity: 1, fulfilmentMode: "vendor_delivery", dates: dates6, ...extra });

test("a subscription charges, for every delivery, the product price plus its GST plus its delivery fee", async () => {
  const r = await price(world({ gstMode: "vendor" }));
  assert.equal(r.deliveries.length, 6);
  const one = r.deliveries[0].billing;
  assert.equal(one.subtotal, 50);
  assert.equal(one.gstAmount, 2.5, "5% GST on groceries, charged because the vendor issues a tax invoice");
  assert.equal(one.deliveryFee, 25, "3 km from the kitchen is the Rs 25 slab");
  assert.equal(one.totalAmount, 77.5);
  assert.equal(r.total, 465, "6 deliveries x Rs 77.50, nothing else");
});

test("no GST for a vendor without it, no delivery fee for pickup, and the markup is added to the product price", async () => {
  const noGst = await price(world({ gstMode: "none" }));
  assert.equal(noGst.deliveries[0].billing.gstAmount, 0);
  assert.equal(noGst.total, 6 * 75);
  const pickup = await price(world({ gstMode: "none" }), { fulfilmentMode: "self_pickup" });
  assert.equal(pickup.deliveries[0].billing.deliveryFee, 0);
  assert.equal(pickup.total, 6 * 50);
  const marked = await price(world({ gstMode: "none", markup: 10 }), { fulfilmentMode: "self_pickup" });
  assert.equal(marked.deliveries[0].customerUnit, 55);
  assert.equal(marked.total, 330);
});

test("quantity multiplies the product and its GST but not the delivery fee", async () => {
  const r = await price(world({ gstMode: "vendor" }), { quantity: 3, dates: ["2026-11-08"] });
  assert.equal(r.deliveries[0].billing.subtotal, 150);
  assert.equal(r.deliveries[0].billing.gstAmount, 7.5);
  assert.equal(r.deliveries[0].billing.deliveryFee, 25);
  assert.equal(r.total, 182.5);
});

test("a delivery address beyond the vendor's radius is flagged; an unknown location pays the minimum delivery fee", async () => {
  const far = await price(world({ customer: north(12) }));
  assert.equal(far.withinRadius, false);
  assert.ok(far.warning);
  const unknown = await price(fakeDb({ vendors: [{ id: "v1", category: "Groceries", latitude: store.latitude, longitude: store.longitude, service_radius_km: 8 }], vendor_plans: [], vendor_commercial_terms: [], vendor_item_markups: [], customer_preferences: [], home_menu_days: [] }));
  assert.equal(unknown.deliveries[0].billing.deliveryFee, 20);
});

test("a home-food plan is priced per day, each day with its own GST and the same delivery fee, and closed days are dropped", async () => {
  const menu = [
    { vendor_id: "v1", meal: "lunch", diet: "veg", weekday: "Mon", dishes: ["Idli"], is_open: true, price: 100 },
    { vendor_id: "v1", meal: "lunch", diet: "veg", weekday: "Tue", dishes: ["Dal"], is_open: true, price: 150 },
    { vendor_id: "v1", meal: "lunch", diet: "veg", weekday: "Wed", dishes: ["Rice"], is_open: false, price: 90 },
  ];
  const r = await priceSchedule(world({ category: "Home food", menu }), { customerId: "c1", vendorId: "v1", menuItem: { id: "m1", name: "Veg lunch plan", vendor_base_price: 100 }, quantity: 1, fulfilmentMode: "vendor_delivery", dates: ["2026-11-09", "2026-11-10", "2026-11-11"] });
  assert.equal(r.isPlan, true);
  assert.deepEqual(r.deliveries.map((d) => [d.date, d.billing.subtotal, d.billing.gstAmount, d.billing.deliveryFee, d.billing.totalAmount]), [["2026-11-09", 100, 5, 25, 130], ["2026-11-10", 150, 7.5, 25, 182.5]]);
  assert.deepEqual(r.skipped, ["2026-11-11"]);
  assert.equal(r.total, 312.5);
  assert.match(r.deliveries[1].label, /Veg lunch plan · Tue: Dal/);
});

test("order columns: totals always, the detailed breakdown separately so an older database still works", async () => {
  const r = await price(world({ gstMode: "vendor" }), { dates: ["2026-11-08"] });
  const t = orderTotals(r.deliveries[0]);
  assert.deepEqual(t.base, { vendor_base_total: 50, markup_total: 0, tax_amount: 2.5, delivery_fee: 25, customer_total: 77.5 });
  assert.equal(t.breakdown.total_amount, 77.5); assert.equal(t.breakdown.invoice_type, "tax_invoice");
  assert.equal(missingColumn({ code: "42703" }), true); assert.equal(missingColumn({ message: "schema cache" }), true); assert.equal(missingColumn({ message: "network down" }), false);
});
