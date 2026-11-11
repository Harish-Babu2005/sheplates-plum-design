import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SKU_CATEGORIES,
  SKU_MASTER_RECORDS,
  SKU_GROUPS_BY_CATEGORY,
  SKUS_BY_CATEGORY_AND_GROUP,
  getSkuGroups,
  getSkusForGroup,
  findSkuDefinition,
  validateSkuSelection,
  formatProductPackLabel,
  parsePackSpec,
} from "../lib/sku-master.ts";

test("Category-Wise SKU Master: Categories & Master Data Counts", () => {
  // 1. Maintain the exact 11 business categories
  const EXPECTED_CATEGORIES = [
    "Milk & dairy",
    "Home food",
    "Caterer",
    "Meat & fish",
    "Vegetables",
    "Groceries",
    "Eggs",
    "Bakery",
    "Snacks",
    "Rice & staples",
    "Other",
  ];
  assert.equal(SKU_CATEGORIES.length, 11, "Must have exactly 11 business categories");
  assert.deepEqual([...SKU_CATEGORIES], EXPECTED_CATEGORIES, "Category names must match exact master specification");

  // 2. Exact counts: 133 SKU groups and 961 SKUs
  let totalGroups = 0;
  for (const cat of SKU_CATEGORIES) {
    const groups = getSkuGroups(cat);
    assert.ok(groups.length > 0, `Category '${cat}' must have product groups`);
    totalGroups += groups.length;
  }
  assert.equal(totalGroups, 133, "Total SKU groups across all 11 categories must be exactly 133");
  assert.equal(SKU_MASTER_RECORDS.length, 961, "Total predefined SKU records must be exactly 961");
});

test("Category-Wise SKU Master: Product-Specific Unit Types", () => {
  // Unit type must depend on the product group, not merely on the parent category.

  // Milk & dairy
  const milkSkus = getSkusForGroup("Milk & dairy", "Milk");
  assert.ok(milkSkus.length > 0, "Milk SKUs must exist");
  assert.ok(milkSkus.some((s) => s.unitType === "ml"), "Milk must support ml");
  assert.ok(milkSkus.some((s) => s.unitType === "L"), "Milk must support L");

  const curdSkus = getSkusForGroup("Milk & dairy", "Curd");
  assert.ok(curdSkus.some((s) => s.unitType === "g"), "Curd must support g");
  assert.ok(curdSkus.some((s) => s.unitType === "kg"), "Curd must support kg");

  const cheeseSliceSkus = getSkusForGroup("Milk & dairy", "Cheese slices");
  assert.ok(cheeseSliceSkus.every((s) => s.unitType === "pcs"), "Cheese slices must be in pcs");

  // Vegetables
  const tomatoSkus = getSkusForGroup("Vegetables", "Tomato");
  assert.ok(tomatoSkus.some((s) => s.unitType === "kg"), "Tomato must support kg");

  const leafySkus = getSkusForGroup("Vegetables", "Leafy greens");
  assert.ok(leafySkus.every((s) => s.unitType === "bunch"), "Leafy greens must be in bunch");

  const lemonSkus = getSkusForGroup("Vegetables", "Lemon");
  assert.ok(lemonSkus.every((s) => s.unitType === "pcs"), "Lemon must be in pcs");

  // Home food & Caterer
  const idliSkus = getSkusForGroup("Home food", "Idli");
  assert.ok(idliSkus.every((s) => s.unitType === "pcs"), "Idli must be in pcs");

  const miniMealSkus = getSkusForGroup("Home food", "Mini meals");
  assert.ok(miniMealSkus.every((s) => s.unitType === "portion"), "Mini meals must be in portion");

  const buffetSkus = getSkusForGroup("Caterer", "Buffet catering");
  assert.ok(buffetSkus.every((s) => s.unitType === "persons"), "Buffet catering must be in persons");
});

test("Category-Wise SKU Master: Cascading Validation Logic", () => {
  // Valid combinations
  const validMilk = validateSkuSelection("Milk & dairy", "Milk", "500 ml");
  assert.equal(validMilk.valid, true);
  assert.equal(validMilk.sku?.unitType, "ml");

  const validTomato = validateSkuSelection("Vegetables", "Tomato", "1 kg");
  assert.equal(validTomato.valid, true);
  assert.equal(validTomato.sku?.unitType, "kg");

  // Invalid: category does not match group
  const wrongCategory = validateSkuSelection("Bakery", "Milk", "500 ml");
  assert.equal(wrongCategory.valid, false);
  assert.match(wrongCategory.error || "", /Product group "Milk" does not belong to category "Bakery"/);

  // Invalid: pack size does not exist for group
  const wrongPack = validateSkuSelection("Milk & dairy", "Milk", "99 kg");
  assert.equal(wrongPack.valid, false);
  assert.match(wrongPack.error || "", /Pack size "99 kg" is not predefined/);

  // Other option support for custom group or pack size
  const customGroupSku = validateSkuSelection("Milk & dairy", "Other", "500 ml", "ml");
  assert.equal(customGroupSku.valid, true);
  assert.equal(customGroupSku.sku?.group, "Other");

  const customPackSku = validateSkuSelection("Milk & dairy", "Milk", "Other", "ml");
  assert.equal(customPackSku.valid, true);
  assert.equal(customPackSku.sku?.packSize, "Other");
});

test("Category-Wise SKU Master: Label Formatting & Unit Parsing", () => {
  // Format product pack label cleanly
  assert.equal(formatProductPackLabel("Fresh Cow Milk", "500 ml"), "Fresh Cow Milk – 500 ml");
  assert.equal(formatProductPackLabel("Fresh Cow Milk – 500 ml", "500 ml"), "Fresh Cow Milk – 500 ml");
  assert.equal(formatProductPackLabel("Tomato", "1 kg"), "Tomato – 1 kg");

  // Parse pack spec amounts and measures
  const mlSpec = parsePackSpec("500 ml", "ml");
  assert.equal(mlSpec.amount, 500);
  assert.equal(mlSpec.measure, "ml");

  const kgSpec = parsePackSpec("1.5 kg", "kg");
  assert.equal(kgSpec.amount, 1.5);
  assert.equal(kgSpec.measure, "kg");

  const pcsSpec = parsePackSpec("6 pcs", "pcs");
  assert.equal(pcsSpec.amount, 6);
  assert.equal(pcsSpec.measure, "piece");

  const personsSpec = parsePackSpec("50 persons", "persons");
  assert.equal(personsSpec.amount, 50);
  assert.equal(personsSpec.measure, "persons");
});

test("Category-Wise SKU Master: Migration File Verification", () => {
  const sql = fs.readFileSync("supabase/migrations/20261111000100_category_sku_master.sql", "utf8");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.product_categories"), "Creates product_categories table");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.product_sku_groups"), "Creates product_sku_groups table");
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.product_skus"), "Creates product_skus table");
  assert.ok(sql.includes("ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS sku_group_id"), "Adds sku_group_id to vendor_menu_items");
  assert.ok(sql.includes("ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS pack_size"), "Adds pack_size to vendor_menu_items");
  assert.ok(sql.includes("ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS unit_type"), "Adds unit_type to vendor_menu_items");
});

test("Map Interruption & Modal Stacking Context Fixes", () => {
  const dialogCode = fs.readFileSync("components/ui/dialog.tsx", "utf8");
  assert.ok(dialogCode.includes("z-[1100]"), "DialogOverlay uses z-[1100] above Leaflet 1000");
  assert.ok(dialogCode.includes("z-[1101]"), "DialogContent uses z-[1101] above Leaflet 1000");

  const selectCode = fs.readFileSync("components/ui/select.tsx", "utf8");
  assert.ok(selectCode.includes("z-[1200]"), "SelectContent uses z-[1200] above DialogContent 1101");

  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.ok(css.includes("contain: paint !important;"), "Maps enforce contain: paint to prevent canvas breakout");
});

test("Category-Wise SKU Form: Clean Labels & Other Options", () => {
  const code = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  // Ensure "Step 1", "Step 2", etc. are removed from field labels
  assert.ok(!code.includes('label="Step 1 – Category"'), "Step 1 prefix removed");
  assert.ok(!code.includes('label="Step 2 – Product / SKU group"'), "Step 2 prefix removed");
  assert.ok(!code.includes('label="Step 3 – Predefined pack size"'), "Step 3 prefix removed");
  assert.ok(!code.includes('label="Step 4 – Predefined unit"'), "Step 4 prefix removed");

  // Ensure clean labels exist
  assert.ok(code.includes('label="Category"'), 'Field label="Category" exists');
  assert.ok(code.includes('label="Product / SKU group"'), 'Field label="Product / SKU group" exists');
  assert.ok(code.includes('label="Predefined pack size"'), 'Field label="Predefined pack size" exists');
  assert.ok(code.includes('label="Unit"'), 'Field label="Unit" exists');

  // Ensure Other option is supported for groups and pack sizes
  assert.ok(code.includes('customGroup'), "Supports custom product group input when Other is selected");
  assert.ok(code.includes('customPackSize'), "Supports custom pack size input when Other is selected");
  assert.ok(code.includes('<SelectItem value="Other">Other</SelectItem>'), "Pack size select includes Other option");
});
