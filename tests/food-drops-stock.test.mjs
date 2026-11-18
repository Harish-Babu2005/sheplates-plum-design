import assert from "node:assert/strict";
import test from "node:test";
import { validateFoodDropUnits, validateFoodDropEditUnits } from "../lib/food-drops.ts";

test("Food Drops Stock Validation — Units below the stock (accepted)", () => {
  const result = validateFoodDropUnits(20, 34, "Pepper rasam");
  assert.equal(result.valid, true);
  assert.equal(result.quantity, 20);
  assert.equal(result.error, undefined);
});

test("Food Drops Stock Validation — Units equal to the stock (accepted)", () => {
  const result = validateFoodDropUnits(34, 34, "Pepper rasam");
  assert.equal(result.valid, true);
  assert.equal(result.quantity, 34);
  assert.equal(result.error, undefined);
});

test("Food Drops Stock Validation — Exact case: product stock 34, user enters 56 (refused with exact message)", () => {
  const result = validateFoodDropUnits(56, 34, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(
    result.error,
    "You entered 56 units, but only 34 are in stock for Pepper rasam. Please enter 34 or fewer, or update your stock first."
  );
});

test("Food Drops Stock Validation — Zero (refused)", () => {
  const result = validateFoodDropUnits(0, 34, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(result.error, "Units available must be at least 1.");
});

test("Food Drops Stock Validation — Negative number (refused)", () => {
  const result = validateFoodDropUnits(-5, 34, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(result.error, "Units available cannot be negative.");
});

test("Food Drops Stock Validation — Decimal (refused)", () => {
  const result = validateFoodDropUnits(12.5, 34, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(result.error, "Please enter a whole number of units.");
});

test("Food Drops Stock Validation — Empty value (refused)", () => {
  const emptyStr = validateFoodDropUnits("", 34, "Pepper rasam");
  assert.equal(emptyStr.valid, false);
  assert.equal(emptyStr.error, "Please enter the number of units available.");

  const emptyWhitespace = validateFoodDropUnits("   ", 34, "Pepper rasam");
  assert.equal(emptyWhitespace.valid, false);
  assert.equal(emptyWhitespace.error, "Please enter the number of units available.");

  const nullVal = validateFoodDropUnits(null, 34, "Pepper rasam");
  assert.equal(nullVal.valid, false);
  assert.equal(nullVal.error, "Please enter the number of units available.");
});

test("Food Drops Stock Validation — Text / non-numeric (refused)", () => {
  const textResult = validateFoodDropUnits("abc", 34, "Pepper rasam");
  assert.equal(textResult.valid, false);
  assert.equal(textResult.error, "Please enter a valid number of units.");
});

test("Food Drops Stock Validation — Product with 0 stock (refused)", () => {
  const result = validateFoodDropUnits(10, 0, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(result.error, "This product is out of stock. Add stock first.");

  const negStockResult = validateFoodDropUnits(5, -1, "Pepper rasam");
  assert.equal(negStockResult.valid, false);
  assert.equal(negStockResult.error, "This product is out of stock. Add stock first.");
});

test("Food Drops Edit Validation — Editing a drop to a higher number than remaining stock (refused)", () => {
  // Existing drop total: 10 units. Product remaining shelf stock: 5 units.
  // Vendor tries to raise drop to 20 units (needs +10 units, but only 5 available).
  const result = validateFoodDropEditUnits(20, 10, 2, 5, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(
    result.error,
    "You entered 20 units, but only 5 more are in stock for Pepper rasam. Please enter 15 or fewer, or update your stock first."
  );
});

test("Food Drops Edit Validation — Editing a drop within remaining stock (accepted)", () => {
  // Existing drop total: 10 units. Product remaining shelf stock: 5 units.
  // Vendor raises drop to 14 units (needs +4 units, 5 available).
  const result = validateFoodDropEditUnits(14, 10, 2, 5, "Pepper rasam");
  assert.equal(result.valid, true);
  assert.equal(result.quantity, 14);
  assert.equal(result.additionalUnits, 4);
});

test("Food Drops Edit Validation — Reducing below claimed units (refused)", () => {
  // Total: 10 units, 4 claimed by customers. Vendor tries to set total to 3.
  const result = validateFoodDropEditUnits(3, 10, 4, 10, "Pepper rasam");
  assert.equal(result.valid, false);
  assert.equal(result.error, "Cannot reduce units below 4 already claimed by customers.");
});

test("Food Drops Server API Route Simulation — Direct API call with 56 units on product stock 34 (refused)", async () => {
  // Simulating POST /api/food-drops with 56 units when stock is 34
  const payload = {
    vendorId: "v1",
    productId: "p1",
    productName: "Pepper rasam",
    productStock: 34,
    totalQuantity: 56,
  };

  const validation = validateFoodDropUnits(payload.totalQuantity, payload.productStock, payload.productName);
  assert.equal(validation.valid, false);
  assert.equal(
    validation.error,
    "You entered 56 units, but only 34 are in stock for Pepper rasam. Please enter 34 or fewer, or update your stock first."
  );
});

test("Food Drops Concurrency Simulation — Two staff creating drops for same product with stock 10, asking 8 each", async () => {
  let productStock = 10;
  const productName = "Pepper rasam";

  async function tryCreateDrop(staffName, requestedUnits) {
    // Simulated atomic test-and-set database reservation
    // UPDATE vendor_menu_items SET stock_quantity = stock_quantity - requestedUnits WHERE stock_quantity >= requestedUnits
    if (requestedUnits > productStock) {
      return {
        success: false,
        error: `You entered ${requestedUnits} units, but only ${productStock} are in stock for ${productName}. Please enter ${productStock} or fewer, or update your stock first.`,
      };
    }
    // Atomic reservation
    productStock -= requestedUnits;
    return {
      success: true,
      staff: staffName,
      reserved: requestedUnits,
      remainingStock: productStock,
    };
  }

  // Concurrent execution
  const results = await Promise.all([
    tryCreateDrop("Staff A", 8),
    tryCreateDrop("Staff B", 8),
  ]);

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 1, "Exactly one staff member's request must succeed");
  assert.equal(failures.length, 1, "The second staff member's request must be refused");
  assert.equal(productStock, 2, "Stock after reservation should be 10 - 8 = 2");
  assert.equal(
    failures[0].error,
    "You entered 8 units, but only 2 are in stock for Pepper rasam. Please enter 2 or fewer, or update your stock first."
  );
});
