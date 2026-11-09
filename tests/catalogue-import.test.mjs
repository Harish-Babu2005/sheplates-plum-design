import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");
const load = async () => {
  const foodType = ts.transpileModule(await read("lib/food-type.ts"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const foodUrl = `data:text/javascript;base64,${Buffer.from(foodType).toString("base64")}`;
  let source = await read("lib/catalogue-import.ts");
  source = source.replace('"./food-type"', JSON.stringify(foodUrl));
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
};
const categories = ["Milk & dairy", "Home food", "Caterer", "Meat & fish", "Vegetables", "Groceries", "Eggs", "Bakery", "Snacks", "Rice & staples", "Other"];
const opts = { categories, defaultCategory: "Home food" };

test("a CSV with a header row is read exactly, including the price and the food type", async () => {
  const { readCatalogueText } = await load();
  const result = readCatalogueText("Name,Category,Pack,Price,Stock,Food type\nMasala dosa,Home food,1 portion,90,20,Veg\nChicken biryani,home food,1 complete meal,₹180,15,Non-veg\nFarm eggs,Eggs,Tray of 12 eggs,96,30,Egg\n", opts);
  assert.equal(result.structured, true);
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows.map((r) => [r.name, r.category, r.pack, r.price, r.stock, r.foodType]), [
    ["Masala dosa", "Home food", "1 portion", 90, 20, "veg"],
    ["Chicken biryani", "Home food", "1 complete meal", 180, 15, "non_veg"],
    ["Farm eggs", "Eggs", "Tray of 12 eggs", 96, 30, "egg"],
  ]);
  assert.ok(result.rows.every((r) => r.problems.length === 0));
});

test("quoted cells with commas, semicolon and tab files, and a spreadsheet header with different words all work", async () => {
  const { readCatalogueText } = await load();
  const quoted = readCatalogueText('Product name,Rate,Qty\n"Paneer, fresh 200 g",95,10\n', opts);
  assert.equal(quoted.rows[0].name, "Paneer, fresh 200 g");
  assert.equal(quoted.rows[0].price, 95);
  assert.equal(quoted.rows[0].stock, 10);
  const semi = readCatalogueText("Item;Price;Stock\nRagi malt;120;8\n", opts);
  assert.equal(semi.rows[0].price, 120);
  const tabs = readCatalogueText("Item\tPrice\tStock\nRagi malt\t120\t8\n", opts);
  assert.equal(tabs.rows[0].stock, 8);
});

test("a category typed loosely is matched to a real one; unknown ones use the store's own category", async () => {
  const { matchCategory } = await load();
  assert.equal(matchCategory("Milk & Dairy", categories, "Other"), "Milk & dairy");
  assert.equal(matchCategory("dairy", categories, "Other"), "Milk & dairy");
  assert.equal(matchCategory("VEGETABLE", categories, "Other"), "Vegetables");
  assert.equal(matchCategory("fish", categories, "Other"), "Meat & fish");
  assert.equal(matchCategory("gadgets", categories, "Groceries"), "Groceries");
  assert.equal(matchCategory("", categories, "Groceries"), "Groceries");
});

test("food type is only taken from what the vendor wrote, never guessed from the name", async () => {
  const { readFoodType, readCatalogueText } = await load();
  assert.equal(readFoodType("Vegetarian"), "veg");
  assert.equal(readFoodType("non veg"), "non_veg");
  assert.equal(readFoodType("Non-Vegetarian"), "non_veg");
  assert.equal(readFoodType("Contains egg"), "egg");
  assert.equal(readFoodType("maybe"), undefined);
  const guessed = readCatalogueText("Name,Price,Stock\nChicken curry,150,5\nDal,80,5\n", opts);
  assert.deepEqual(guessed.rows.map((r) => r.foodType), [undefined, undefined]);
});

test("rows missing a price or stock are kept and say what is missing; the header is never turned into a product", async () => {
  const { readCatalogueText, rowProblems } = await load();
  const result = readCatalogueText("Name,Price,Stock\nTomato,,\nOnion,30,0\n", opts);
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every((r) => r.name !== "Name"));
  assert.deepEqual(result.rows[0].problems.includes("Add a price"), true);
  assert.deepEqual(rowProblems({ name: "Onion", price: 30, stock: 0 }), ["Add the pack stock"]);
  assert.deepEqual(rowProblems({ name: "Onion", price: 30, stock: 4 }), []);
});

test("a list without a header is read cell by cell; a plain list of names asks for the smart reader", async () => {
  const { readCatalogueText } = await load();
  const simple = readCatalogueText("Rice, 5 kg, 320, 12\nSugar, 1 kg, 48, 30\n", opts);
  assert.equal(simple.structured, true);
  assert.deepEqual(simple.rows.map((r) => [r.name, r.pack, r.price, r.stock]), [["Rice", "5 kg", 320, 12], ["Sugar", "1 kg", 48, 30]]);
  const names = readCatalogueText("1. Tomato 1 kg\n2. Onion 2 kg\n", opts);
  assert.equal(names.structured, false);
  assert.equal(names.rows.length, 2);
});

test("a very long list is cut at the limit and says so; blank lines and a Windows file with a BOM are fine", async () => {
  const { readCatalogueText, MAX_IMPORT_ROWS } = await load();
  const lines = ["Name,Price,Stock", ...Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => `Item ${i},10,1`)].join("\r\n");
  const long = readCatalogueText(lines, opts);
  assert.equal(long.rows.length, MAX_IMPORT_ROWS);
  assert.equal(long.truncated, true);
  const bom = readCatalogueText("﻿Name,Price,Stock\r\n\r\nDal,80,5\r\n", opts);
  assert.equal(bom.rows.length, 1);
  assert.equal(bom.rows[0].name, "Dal");
});

test("the downloadable template reads back into its own four rows with no problems", async () => {
  const { readCatalogueText, CATALOGUE_TEMPLATE_CSV } = await load();
  const result = readCatalogueText(CATALOGUE_TEMPLATE_CSV, opts);
  assert.equal(result.rows.length, 4);
  assert.ok(result.rows.every((r) => r.problems.length === 0 && r.foodType));
});

test("numbers: only whole packs, at most 2 price decimals, real thousands grouping, and the database limits", async () => {
  const { readCatalogueText, parseNumber, rowProblems, MAX_PRICE, MAX_STOCK } = await load();
  assert.equal(parseNumber("1,200"), 1200);
  assert.equal(parseNumber("12,00,000"), 1200000, "Indian grouping");
  assert.equal(parseNumber("₹120"), 120);
  assert.equal(parseNumber("150/-"), 150);
  assert.equal(parseNumber("49,50"), null, "a comma that is not thousands grouping is not a number");
  assert.equal(parseNumber("1 200"), null);
  assert.equal(parseNumber("1e3"), null);
  assert.deepEqual(rowProblems({ name: "x", price: 49.999, stock: 5 }), ["The price can have at most 2 decimal places"]);
  assert.deepEqual(rowProblems({ name: "x", price: 49.5, stock: 2.5 }), ["Stock must be a whole number of packs"]);
  assert.deepEqual(rowProblems({ name: "x", price: MAX_PRICE + 1, stock: 1 }), ["The price is too large"]);
  assert.deepEqual(rowProblems({ name: "x", price: MAX_PRICE, stock: MAX_STOCK }), []);
  assert.deepEqual(rowProblems({ name: "x", price: 0.01, stock: 1 }), []);
  const bad = readCatalogueText("Name,Price,Stock\nNegative stock,20,-3\nText stock,20,many\nBlank stock,20,\nUnit in stock column,20,5 kg\n", opts);
  assert.deepEqual(bad.rows.map((r) => r.problems.length === 0), [false, false, false, true]);
  assert.equal(bad.rows[3].pack, "5 kg", "a quantity such as 5 kg is still read as the pack size");
  const noColumn = readCatalogueText("Name,Price\nNo stock column,20\n", opts);
  assert.equal(noColumn.rows[0].stock, 1, "no stock column at all means 1 pack");
});
