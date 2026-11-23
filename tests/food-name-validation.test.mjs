import { test } from "node:test";
import assert from "node:assert/strict";
import { quickDenyCheck, MIN_NAME_LENGTH } from "../lib/food-name-validator.ts";

test("Food name validator: rejects obvious non-food items", () => {
  const nonFoodItems = ["Earpods", "earpod", "Phone", "Smartphones", "Shirt", "T-shirt", "jeans", "123", "asdf", "laptop", "chair", "table", "shampoo"];
  for (const item of nonFoodItems) {
    const res = quickDenyCheck(item);
    assert.ok(res, `Expected quickDenyCheck to return a result for ${item}`);
    assert.equal(res.isFood, false, `Expected ${item} to be marked isFood: false`);
  }
});

test("Food name validator: rejects empty or short names under MIN_NAME_LENGTH", () => {
  const shortNames = ["", " ", "a"];
  for (const item of shortNames) {
    const res = quickDenyCheck(item);
    assert.ok(res);
    assert.equal(res.isFood, false);
  }
});

test("Food name validator: allows genuine food items to pass deny check", () => {
  const foodItems = ["Murukku", "Fresh Cow Milk (500 ml)", "Idli Batter", "Paneer Butter Masala", "Gulab Jamun", "Filter Coffee Powder"];
  for (const item of foodItems) {
    const res = quickDenyCheck(item);
    assert.equal(res, null, `Expected genuine food item ${item} to pass deny check`);
  }
});
