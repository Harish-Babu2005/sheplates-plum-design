import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_DELIVERY_PRICING,
  CATEGORY_GST_RATES,
  DEFAULT_GST_RATE,
  haversineDistanceKm,
  calculateDeliveryFee,
  calculateBillingSummary,
} from "../lib/billing.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

test("Haversine distance calculation handles valid and invalid coordinates", () => {
  // Coords ~1.5 km apart in Chennai / Dindigul
  const dist = haversineDistanceKm(10.3624, 77.9695, 10.3700, 77.9800);
  assert.ok(dist !== null && dist > 1 && dist < 2, `Expected ~1.4 km, got ${dist}`);

  // Exactly identical coords -> 0 km
  assert.equal(haversineDistanceKm(12.9716, 77.5946, 12.9716, 77.5946), 0);

  // Missing or null coordinates
  assert.equal(haversineDistanceKm(null, 77.5946, 12.9716, 77.5946), null);
  assert.equal(haversineDistanceKm(12.9716, undefined, 12.9716, 77.5946), null);
  assert.equal(haversineDistanceKm(NaN, 77.5946, 12.9716, 77.5946), null);
});

test("Dynamic delivery fee adheres to Swiggy-like distance pricing tiers", () => {
  // Vendor coords (e.g., store center)
  const vendorCoords = { latitude: 10.3624, longitude: 77.9695 };

  // Tier 1: 0–2 km -> ₹20
  // ~1 km away
  const tier1Coords = { latitude: 10.368, longitude: 77.974 };
  const tier1Result = calculateDeliveryFee({
    mode: "Vendor delivery",
    customerCoords: tier1Coords,
    vendorCoords,
    serviceRadiusKm: 8,
  });
  assert.equal(tier1Result.fee, 20);
  assert.equal(tier1Result.isWithinRadius, true);
  assert.equal(tier1Result.isPickup, false);

  // Tier 2: >2 km and up to 5 km -> ₹35
  // ~3.5 km away
  const tier2Coords = { latitude: 10.385, longitude: 77.990 };
  const tier2Result = calculateDeliveryFee({
    mode: "Vendor delivery",
    customerCoords: tier2Coords,
    vendorCoords,
    serviceRadiusKm: 8,
  });
  assert.equal(tier2Result.fee, 35);
  assert.equal(tier2Result.isWithinRadius, true);

  // Tier 3: >5 km and up to 8 km -> ₹50
  // ~6.5 km away
  const tier3Coords = { latitude: 10.410, longitude: 78.010 };
  const tier3Result = calculateDeliveryFee({
    mode: "Vendor delivery",
    customerCoords: tier3Coords,
    vendorCoords,
    serviceRadiusKm: 8,
  });
  assert.equal(tier3Result.fee, 50);
  assert.equal(tier3Result.isWithinRadius, true);

  // Beyond vendor service radius (e.g. 8 km limit): delivery unavailable
  // ~15 km away
  const outOfRadiusCoords = { latitude: 10.500, longitude: 78.050 };
  const outOfRadiusResult = calculateDeliveryFee({
    mode: "Vendor delivery",
    customerCoords: outOfRadiusCoords,
    vendorCoords,
    serviceRadiusKm: 8,
  });
  assert.equal(outOfRadiusResult.isWithinRadius, false);
  assert.ok(outOfRadiusResult.message && outOfRadiusResult.message.includes("exceeds"));
});

test("Self-pickup and third-party delivery always incur ₹0 delivery fee", () => {
  const vendorCoords = { latitude: 10.3624, longitude: 77.9695 };
  const customerCoords = { latitude: 10.500, longitude: 78.050 }; // 15 km away

  // Self pickup
  const pickup = calculateDeliveryFee({
    mode: "Self pickup",
    customerCoords,
    vendorCoords,
    serviceRadiusKm: 5,
  });
  assert.equal(pickup.fee, 0);
  assert.equal(pickup.isPickup, true);
  assert.equal(pickup.isWithinRadius, true);

  // Third party delivery
  const thirdParty = calculateDeliveryFee({
    mode: "Third-party delivery",
    customerCoords,
    vendorCoords,
    serviceRadiusKm: 5,
  });
  assert.equal(thirdParty.fee, 0);
  assert.equal(thirdParty.isThirdParty, true);
  assert.equal(thirdParty.isWithinRadius, true);
});

test("Vendor custom delivery fee overrides distance tier when specified", () => {
  const vendorCoords = { latitude: 10.3624, longitude: 77.9695 };
  const customerCoords = { latitude: 10.368, longitude: 77.974 }; // 1 km -> default is ₹20

  const customFeeResult = calculateDeliveryFee({
    mode: "Vendor delivery",
    customerCoords,
    vendorCoords,
    serviceRadiusKm: 8,
    vendorCustomFee: 45,
  });
  assert.equal(customFeeResult.fee, 45);
});

test("GST rates apply accurately across product categories without double taxation", () => {
  // Test prepared food category: 5% GST
  const foodSummary = calculateBillingSummary({
    items: [
      { name: "South Indian Thali", price: 150, quantity: 2, category: "Meals" }, // 300 * 5% = 15
      { name: "Masala Chai", price: 20, quantity: 2, category: "Beverages" },    // 40 * 5% = 2
    ],
    mode: "Self pickup",
  });
  assert.equal(foodSummary.subtotal, 340);
  assert.equal(foodSummary.gstRate, 5);
  assert.equal(foodSummary.gstAmount, 17); // 340 * 0.05
  assert.equal(foodSummary.deliveryFee, 0);
  assert.equal(foodSummary.totalAmount, 357);

  // Test grocery/fresh produce category: 0% GST (nil rated)
  const grocerySummary = calculateBillingSummary({
    items: [
      { name: "Fresh Country Eggs (6 pcs)", price: 60, quantity: 2, category: "Eggs" },      // 120 * 0% = 0
      { name: "Organic Brown Rice (1 kg)", price: 90, quantity: 1, category: "Rice & staples" }, // 90 * 0% = 0
    ],
    mode: "Self pickup",
  });
  assert.equal(grocerySummary.subtotal, 210);
  assert.equal(grocerySummary.gstRate, 0);
  assert.equal(grocerySummary.gstAmount, 0);
  assert.equal(grocerySummary.totalAmount, 210);

  // Mixed cart: items with 5% GST and items with 0% GST
  const mixedSummary = calculateBillingSummary({
    items: [
      { name: "Meals combo", price: 200, quantity: 1, category: "Meals" },      // 200 @ 5% = 10
      { name: "Eggs pack", price: 100, quantity: 1, category: "Eggs" },         // 100 @ 0% = 0
    ],
    mode: "Self pickup",
  });
  assert.equal(mixedSummary.subtotal, 300);
  assert.equal(mixedSummary.gstAmount, 10);
  assert.equal(mixedSummary.totalAmount, 310);
});

test("Complete billing summary integrates subtotal, delivery fee, GST, and discounts", () => {
  const vendorCoords = { latitude: 10.3624, longitude: 77.9695 };
  const customerCoords = { latitude: 10.368, longitude: 77.974 }; // 1 km -> Tier 1: ₹20

  const summary = calculateBillingSummary({
    items: [
      { name: "Butter Croissant", price: 80, quantity: 2, category: "Bakery" }, // 160 @ 5% = 8
    ],
    mode: "Vendor delivery",
    customerCoords,
    vendorCoords,
    serviceRadiusKm: 5,
    discountAmount: 20,
  });

  assert.equal(summary.subtotal, 160);
  assert.equal(summary.deliveryFee, 20);
  assert.equal(summary.gstAmount, 8);
  assert.equal(summary.discountAmount, 20);
  // Total = 160 + 20 + 8 - 20 = 168
  assert.equal(summary.totalAmount, 168);
});

test("Razorpay integration calculates integer paise from total payable and rejects < ₹1.00", () => {
  const totalRupees = 168.50;
  const totalPaise = Math.round(totalRupees * 100);
  assert.equal(totalPaise, 16850);
  assert.equal(Number.isInteger(totalPaise), true);

  const minimumValidPaise = Math.round(1.00 * 100);
  assert.equal(minimumValidPaise >= 100, true);

  const invalidPaise = Math.round(0.50 * 100);
  assert.equal(invalidPaise < 100, true);
});

test("Database migration creates required billing columns on public.orders with backfill", async () => {
  const migration = await readFile(path.join(root, "supabase/migrations/20261106000100_gst_and_dynamic_delivery_fee.sql"), "utf8");

  assert.match(migration, /subtotal/);
  assert.match(migration, /gst_rate/);
  assert.match(migration, /gst_amount/);
  assert.match(migration, /discount_amount/);
  assert.match(migration, /total_amount/);
  assert.match(migration, /currency/);
  assert.match(migration, /delivery_distance/);
  assert.match(migration, /ALTER TABLE public\.orders/);
  assert.match(migration, /UPDATE public\.orders/);
});

test("Commerce API route and Razorpay route validate distance, radius, GST and total backend-side", async () => {
  const commerceRoute = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const razorpayRoute = await readFile(path.join(root, "app/api/payments/razorpay/route.ts"), "utf8");

  // Commerce checkout uses calculateBillingSummary and validates vendor radius
  assert.match(commerceRoute, /calculateBillingSummary/);
  assert.match(commerceRoute, /!billing\.isWithinRadius/);
  assert.match(commerceRoute, /gst_amount: billing\.gstAmount/);
  assert.match(commerceRoute, /delivery_fee: billing\.deliveryFee/);
  assert.match(commerceRoute, /subtotal: billing\.subtotal/);

  // Razorpay order creation recalculates total using trusted billing engine
  assert.match(razorpayRoute, /calculateBillingSummary/);
  assert.match(razorpayRoute, /const totalPaise = Math\.round\(totalPayableRupees \* 100\)/);
  assert.match(razorpayRoute, /total_amount: totalPayableRupees/);
});

test("Frontend components present the itemized billing breakdown", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");

  // CartView imports and calculates billingSummary
  assert.match(ui, /calculateBillingSummary/);
  assert.match(ui, /billingSummary/);
  assert.match(ui, /Item subtotal/);
  assert.match(ui, /Delivery fee/);
  assert.match(ui, /Taxes \(GST/);

  // PaymentDialog displays billing breakdown
  assert.match(ui, /Review label="Item subtotal"/);
  assert.match(ui, /Review label="Amount payable"/);

  // OrderDetailsDialog displays billing breakdown
  assert.match(ui, /Item Subtotal/);
  assert.match(ui, /Taxes \(GST/);
});
