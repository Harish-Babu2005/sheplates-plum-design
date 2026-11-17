import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  sanitizeProductDescription,
  validateProductDescription,
} from "../lib/product-description.ts";
import {
  readCatalogueText,
  CATALOGUE_TEMPLATE_CSV,
} from "../lib/catalogue-import.ts";

test("Product Pack Description Feature - Unit & Integration Verification", async (t) => {
  await t.test("PRODUCT_DESCRIPTION_MAX_LENGTH config is exported and equals 200", () => {
    assert.equal(PRODUCT_DESCRIPTION_MAX_LENGTH, 200, "Limit should be 200 characters");
  });

  await t.test("sanitizeProductDescription strips HTML tags and scripts while keeping text", () => {
    const raw = "<script>alert('xss')</script><b>Full Meals:</b> Rice, dal &amp; <i>payasam</i>";
    const cleaned = sanitizeProductDescription(raw);
    assert.ok(!cleaned.includes("<script>"), "Must strip script tags");
    assert.ok(!cleaned.includes("alert"), "Must strip script content");
    assert.ok(!cleaned.includes("<b>"), "Must strip HTML b tag");
    assert.ok(!cleaned.includes("<i>"), "Must strip HTML i tag");
    assert.ok(cleaned.includes("Full Meals:"), "Preserves text content");
    assert.ok(cleaned.includes("Rice, dal"), "Preserves commas and text");
    assert.ok(cleaned.includes("payasam"), "Preserves inner content");
  });

  await t.test("sanitizeProductDescription preserves Tamil and Unicode text", () => {
    const tamilText = "சோறு, சாம்பார், 2 பொரியல் மற்றும் பாயாசம்";
    const cleaned = sanitizeProductDescription(tamilText);
    assert.equal(cleaned, tamilText, "Must preserve Tamil unicode characters exactly");
  });

  await t.test("sanitizeProductDescription preserves emojis, commas, and newlines", () => {
    const textWithEmojis = "🍛 Full meal pack: Rice, sambar, rasam,\n2 poriyal & payasam 😋";
    const cleaned = sanitizeProductDescription(textWithEmojis);
    assert.ok(cleaned.includes("🍛"), "Preserves food emoji");
    assert.ok(cleaned.includes("😋"), "Preserves face emoji");
    assert.ok(cleaned.includes("\n"), "Preserves newline");
    assert.ok(cleaned.includes(","), "Preserves commas");
  });

  await t.test("sanitizeProductDescription and validateProductDescription clamp and validate length", () => {
    const exactly200 = "A".repeat(200);
    assert.equal(sanitizeProductDescription(exactly200).length, 200);
    assert.equal(validateProductDescription(exactly200).valid, true);

    const over200 = "B".repeat(250);
    const sanitizedOver = sanitizeProductDescription(over200);
    assert.equal(sanitizedOver.length, 200, "Sanitizer clamps to 200 chars");

    const validationOver = validateProductDescription(over200);
    assert.equal(validationOver.valid, false, "Validator rejects text exceeding 200 chars");

    // Optional/empty
    assert.equal(validateProductDescription(undefined).valid, true);
    assert.equal(validateProductDescription("").valid, true);
  });

  await t.test("Bulk upload template includes Description column", () => {
    assert.ok(CATALOGUE_TEMPLATE_CSV.includes("Description"), "Template CSV must have Description column");
    assert.ok(
      CATALOGUE_TEMPLATE_CSV.includes("Rice, dal, 2 poriyal with payasam") ||
      CATALOGUE_TEMPLATE_CSV.includes("payasam"),
      "Template CSV should have helpful example contents"
    );
  });

  await t.test("Bulk catalogue parser extracts Description column when provided", () => {
    const csv = `Name,Category,Pack,Price,Stock,Food type,Description
South Indian Meals,Home food,1 pack,120,10,Veg,"Rice, sambar, kootu, poriyal and payasam"
Filter Coffee,Beverages,250 ml,40,20,Veg,"Freshly brewed decoction with pure cow milk"`;

    const result = readCatalogueText(csv, { categories: ["Home food", "Beverages"], defaultCategory: "Home food" });
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].description, "Rice, sambar, kootu, poriyal and payasam");
    assert.equal(result.rows[1].description, "Freshly brewed decoction with pure cow milk");
  });

  await t.test("Bulk catalogue parser handles older CSVs without Description (backwards compatibility)", () => {
    const legacyCsv = `Name,Category,Pack,Price,Stock,Food type
Curd Rice,Home food,1 pack,60,15,Veg
Lemon Rice,Home food,1 pack,70,12,Veg`;

    const result = readCatalogueText(legacyCsv, { categories: ["Home food"], defaultCategory: "Home food" });
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].name, "Curd Rice");
    assert.equal(result.rows[0].description, undefined, "Missing description should be undefined");
    assert.equal(result.rows[1].name, "Lemon Rice");
  });

  await t.test("SQL migration file exists and adds description column to vendor_menu_items", () => {
    const migrationPath = path.resolve("supabase/migrations/20261117000100_product_pack_description.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
    const migrationContent = fs.readFileSync(migrationPath, "utf8");
    assert.ok(migrationContent.includes("ALTER TABLE public.vendor_menu_items") && migrationContent.includes("ADD COLUMN IF NOT EXISTS description text;"));
    assert.ok(migrationContent.includes("char_length(description) <= 200"));
  });

  await t.test("sheplates-v3.tsx Product interface and components support description", () => {
    const code = fs.readFileSync(path.resolve("components/sheplates-v3.tsx"), "utf8");
    assert.ok(code.includes("description?: string;"), "Product interface must have description?: string;");
    assert.ok(code.includes("PRODUCT_DESCRIPTION_MAX_LENGTH"), "sheplates-v3 must use PRODUCT_DESCRIPTION_MAX_LENGTH");
    assert.ok(code.includes("Description (optional)"), "Product dialog must have 'Description (optional)' field label");
    assert.ok(code.includes("Rice, dal, 2 poriyal with payasam"), "Product dialog must include the requested helper text");
    assert.ok(code.includes("product.description"), "Marketplace search and card views must reference product.description");
  });

  await t.test("Order details dialog header has dedicated close button with showCloseButton={false}", () => {
    const code = fs.readFileSync(path.resolve("components/sheplates-v3.tsx"), "utf8");
    const dialogStart = code.indexOf("function OrderDetailsDialog(");
    const dialogEnd = code.indexOf("function OrderTrackingDialog(");
    assert.ok(dialogStart !== -1 && dialogEnd !== -1);
    const dialogCode = code.slice(dialogStart, dialogEnd);

    assert.ok(dialogCode.includes("showCloseButton={false}"), "DialogContent in OrderDetailsDialog must set showCloseButton={false}");
    assert.ok(dialogCode.includes("aria-label=\"Close order details\""), "Header must render explicit close button");
    assert.ok(dialogCode.includes("onClick={() => close()}"), "Close button must trigger close()");
  });
});
