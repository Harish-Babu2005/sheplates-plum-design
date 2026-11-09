import assert from "node:assert/strict";
import test from "node:test";

import {
  DELIVERY_SLABS, MIN_DELIVERY_FEE, deliveryFeeForDistance, haversineDistanceKm, calculateDeliveryFee, calculateBillingSummary,
  commissionPercentFor, COMMISSION_BY_CATEGORY, defaultGstMode, invoiceTypeFor, settlementFor, fulfilmentKind,
} from "../lib/billing.ts";

const store = { latitude: 11.0183, longitude: 76.9725 };
const north = (km) => ({ latitude: store.latitude + km / 111.19492664, longitude: store.longitude });

test("delivery fee: never below Rs 20, and the slab edges belong to the lower slab", () => {
  assert.equal(MIN_DELIVERY_FEE, 20);
  const table = [[0, 20], [0.5, 20], [2, 20], [2.0001, 25], [3.5, 25], [3.5001, 30], [5, 30], [5.0001, 40], [6.5, 40], [6.5001, 50], [8, 50]];
  for (const [km, fee] of table) assert.equal(deliveryFeeForDistance(km), fee, `${km} km`);
  assert.ok(DELIVERY_SLABS.every((slab) => slab.fee >= MIN_DELIVERY_FEE));
});

test("delivery fee beyond 8 km: Rs 10 more for every further started 1.5 km", () => {
  const table = [[8.0001, 60], [9.5, 60], [9.5001, 70], [11, 70], [11.0001, 80], [12.5, 80], [14, 90], [20, 50 + Math.ceil(12 / 1.5) * 10]];
  for (const [km, fee] of table) assert.equal(deliveryFeeForDistance(km), fee, `${km} km`);
});

test("the fee comes from the real distance between the two pins, with exact slab edges", () => {
  const inside = calculateDeliveryFee({ mode: "Vendor delivery", customerCoords: north(1.999), vendorCoords: store, serviceRadiusKm: 10 });
  const outside = calculateDeliveryFee({ mode: "Vendor delivery", customerCoords: north(2.01), vendorCoords: store, serviceRadiusKm: 10 });
  assert.equal(inside.fee, 20);
  assert.equal(outside.fee, 25);
  assert.ok(inside.distanceKnown && Math.abs(inside.distanceKm - 2) < 0.01);
  assert.equal(haversineDistanceKm(null, 1, 1, 1), null);
  assert.equal(haversineDistanceKm(11, "", 11, 77), null);
  assert.equal(haversineDistanceKm(11, 77, 11, 77), 0);
});

test("outside the vendor's radius there is no delivery; a measured distance just inside the radius is accepted", () => {
  const far = calculateDeliveryFee({ mode: "Vendor delivery", customerCoords: north(6), vendorCoords: store, serviceRadiusKm: 5 });
  assert.equal(far.isWithinRadius, false);
  assert.match(far.message, /beyond the vendor's 5 km delivery radius/);
  const edge = calculateDeliveryFee({ mode: "Vendor delivery", customerCoords: north(4.9999), vendorCoords: store, serviceRadiusKm: 5 });
  assert.equal(edge.isWithinRadius, true);
  assert.equal(edge.fee, 30);
});

test("pickups and third-party options carry no delivery fee; there are four options", () => {
  assert.equal(fulfilmentKind("Vendor delivery"), "vendor_delivery");
  assert.equal(fulfilmentKind("Self pickup"), "self_pickup");
  assert.equal(fulfilmentKind("third_party_delivery"), "third_party_customer");
  assert.equal(fulfilmentKind("Third-party pickup by vendor"), "third_party_vendor");
  for (const mode of ["Self pickup", "third_party_delivery", "Third-party pickup by vendor"]) {
    assert.equal(calculateDeliveryFee({ mode, customerCoords: north(6), vendorCoords: store, serviceRadiusKm: 5 }).fee, 0, mode);
  }
});

test("a flat fee set by Operations replaces the slabs but never goes below Rs 20; unknown distance charges the minimum", () => {
  assert.equal(calculateDeliveryFee({ mode: "Vendor delivery", customerCoords: north(7), vendorCoords: store, serviceRadiusKm: 10, vendorCustomFee: 35 }).fee, 35);
  assert.equal(calculateDeliveryFee({ mode: "Vendor delivery", customerCoords: north(7), vendorCoords: store, serviceRadiusKm: 10, vendorCustomFee: 5 }).fee, 20);
  const unknown = calculateDeliveryFee({ mode: "Vendor delivery", serviceRadiusKm: 10 });
  assert.equal(unknown.fee, 20);
  assert.equal(unknown.distanceKnown, false);
});

test("commission follows the vendor's category, a per-vendor rate wins, and Taster pays none", () => {
  const expected = { "Home food": 10, Bakery: 10, Snacks: 10, Vegetables: 5, Fruits: 5, "Meat & fish": 5, "Milk & dairy": 5, Groceries: 3, "Rice & staples": 3 };
  for (const [category, percent] of Object.entries(expected)) assert.equal(commissionPercentFor(category), percent, category);
  assert.equal(commissionPercentFor("Groceries", 4.5), 4.5);
  assert.equal(commissionPercentFor("Groceries", 120), 3, "an impossible override is ignored");
  assert.equal(commissionPercentFor("Home food", 12, "Taster"), 0);
  assert.ok(Object.values(COMMISSION_BY_CATEGORY).every((n) => n >= 0 && n <= 100));
});

test("GST: by item, by who is liable, and the document the customer receives", () => {
  assert.equal(defaultGstMode("Home food"), "platform");
  assert.equal(defaultGstMode("Vegetables"), "none");
  assert.equal(defaultGstMode("Bakery"), "vendor");
  const homeChef = calculateBillingSummary({ items: [{ name: "Meal", price: 100, quantity: 2 }], vendorCategory: "Home food", mode: "Self pickup" });
  assert.equal(homeChef.gstAmount, 10);
  assert.equal(homeChef.invoiceType, "section_9_5");
  assert.equal(homeChef.totalAmount, 210);
  const greens = calculateBillingSummary({ items: [{ name: "Tomato", price: 40, quantity: 1, category: "Vegetables" }], vendorCategory: "Vegetables", mode: "Self pickup" });
  assert.equal(greens.gstAmount, 0);
  assert.equal(greens.invoiceType, "bill_of_supply");
  const oil = calculateBillingSummary({ items: [{ name: "Oil", price: 200, quantity: 1, category: "Groceries" }], vendorCategory: "Groceries", mode: "Self pickup" });
  assert.equal(oil.gstAmount, 10);
  assert.equal(oil.invoiceType, "tax_invoice");
  const notRegistered = calculateBillingSummary({ items: [{ name: "Cake", price: 500, quantity: 1 }], vendorCategory: "Bakery", gstMode: "none", mode: "Self pickup" });
  assert.equal(notRegistered.gstAmount, 0);
  assert.equal(notRegistered.invoiceType, "bill_of_supply");
  const ownRate = calculateBillingSummary({ items: [{ name: "Paneer", price: 100, quantity: 1, gstRate: 12 }], vendorCategory: "Milk & dairy", gstMode: "vendor", mode: "Self pickup" });
  assert.equal(ownRate.gstAmount, 12);
  assert.equal(invoiceTypeFor("vendor", 0), "bill_of_supply");
});

test("the bill has no platform fee; the vendor keeps the whole delivery fee; commission is on the food total only", () => {
  const bill = calculateBillingSummary({
    items: [{ name: "Veg meal", price: 100, quantity: 3 }], mode: "Vendor delivery", customerCoords: north(3), vendorCoords: store, serviceRadiusKm: 8,
    vendorCategory: "Home food", gstMode: "platform", vendorPlan: "Crave",
  });
  assert.equal(bill.subtotal, 300);
  assert.equal(bill.deliveryFee, 25);
  assert.equal(bill.gstAmount, 15);
  assert.equal(bill.totalAmount, 340, "300 food + 15 GST + 25 delivery, nothing else");
  assert.equal(bill.commissionPercent, 10);
  assert.equal(bill.commissionAmount, 30, "10% of 300, not of the delivery fee or GST");
  assert.equal(bill.vendorPayout, 295, "300 + 25 delivery - 30 commission; GST is Sheplates' to pay under 9(5)");
  const vendorLiable = calculateBillingSummary({ items: [{ name: "Oil", price: 200, quantity: 1, category: "Groceries" }], vendorCategory: "Groceries", mode: "Self pickup", gstMode: "vendor" });
  assert.equal(vendorLiable.vendorPayout, 200 + 10 - 6, "GST collected for the vendor is paid to the vendor; commission 3% of 200");
});

test("payment re-prices items and GST but keeps the delivery fee fixed at checkout", () => {
  const bill = calculateBillingSummary({ items: [{ name: "Meal", price: 100, quantity: 1 }], mode: "Vendor delivery", fixedDelivery: { fee: 40, distanceKm: 5.5 }, vendorCategory: "Home food" });
  assert.equal(bill.deliveryFee, 40);
  assert.equal(bill.deliveryDistanceKm, 5.5);
  assert.equal(calculateBillingSummary({ items: [{ name: "Meal", price: 100, quantity: 1 }], mode: "Self pickup", fixedDelivery: { fee: 40 }, vendorCategory: "Home food" }).deliveryFee, 0);
});

test("settlement: every Wednesday, for the Monday to Sunday week before", () => {
  // 2 Nov 2026 is a Monday.
  assert.deepEqual(settlementFor("2026-11-02"), { weekStart: "2026-11-02", weekEnd: "2026-11-08", payoutDate: "2026-11-11" });
  assert.equal(settlementFor("2026-11-05").payoutDate, "2026-11-11");
  assert.equal(settlementFor("2026-11-08").payoutDate, "2026-11-11", "Sunday still belongs to its own week");
  assert.equal(settlementFor("2026-11-09").payoutDate, "2026-11-18", "the next Monday starts the next week");
  assert.equal(new Date("2026-11-11T12:00:00Z").getUTCDay(), 3, "the payout day is a Wednesday");
  assert.equal(settlementFor("2026-12-28").payoutDate, "2027-01-06", "across the year end");
});
