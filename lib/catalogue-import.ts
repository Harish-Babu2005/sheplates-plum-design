/**
 * Reads a vendor's product list (CSV, TSV, plain text, or a spreadsheet already turned into CSV) into draft catalogue rows.
 * Pure and offline: no network, no AI. A list with a header row (Name, Category, Pack, Price, Stock, Food type) is read
 * exactly; a list without one is read cell by cell. The caller may ask the AI to tidy only a list this reader cannot place.
 * The food type is taken only from a column the vendor filled in, never guessed from the name or category.
 */
import { normalizeFoodType, type FoodType } from "./food-type";

export type CatalogueDraftRow = {
  name: string;
  category: string;
  pack: string;
  price: number;
  stock: number;
  foodType?: FoodType;
  /** What the vendor still has to fill in before this row can be published. */
  problems: string[];
};

export type CatalogueReading = {
  rows: CatalogueDraftRow[];
  /** True when a header row was recognised or prices were found, so the list needs no AI help. */
  structured: boolean;
  skipped: number;
  truncated: boolean;
};

export const MAX_IMPORT_ROWS = 300;

const HEADERS: Record<string, string[]> = {
  name: ["name", "product", "product name", "productname", "item", "item name", "itemname", "title", "dish", "dish name"],
  category: ["category", "categories", "group", "section", "department"],
  pack: ["pack", "pack size", "packsize", "selling pack", "unit", "units", "size", "weight", "uom", "unit of measure", "quantity per pack", "pack description"],
  price: ["price", "rate", "mrp", "selling price", "price per pack", "price / pack", "price/pack", "cost", "amount", "rs", "inr", "price rs", "price inr", "price ₹", "₹"],
  stock: ["stock", "qty", "quantity", "available", "available stock", "packs", "no of packs", "no. of packs", "number of packs", "inventory", "count", "pack stock"],
  foodType: ["food type", "foodtype", "veg/non-veg", "veg / non-veg", "veg or non veg", "veg non veg", "veg", "diet", "diet type", "type of food", "veg/nonveg"],
};

const clean = (value: unknown) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
const headerKey = (value: string) => clean(value).toLowerCase().replace(/[()*_:]/g, " ").replace(/\s+/g, " ").trim();

function fieldFor(header: string): keyof typeof HEADERS | null {
  const key = headerKey(header);
  if (!key) return null;
  for (const [field, names] of Object.entries(HEADERS)) if (names.includes(key)) return field as keyof typeof HEADERS;
  return null;
}

/** Splits one text into rows of cells. Handles quoted cells, doubled quotes and line breaks inside quotes. */
export function splitDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((value) => clean(value))) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => clean(value))) rows.push(row);
  return rows;
}

export function detectDelimiter(text: string): string {
  const sample = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 6);
  if (!sample.length) return ",";
  let best = ",";
  let bestScore = 0;
  for (const delimiter of ["\t", ",", ";", "|"]) {
    const counts = sample.map((line) => splitDelimited(line, delimiter)[0]?.length ?? 1);
    const min = Math.min(...counts);
    const score = min > 1 ? min * 10 + (counts.every((count) => count === counts[0]) ? 5 : 0) : 0;
    if (score > bestScore) { best = delimiter; bestScore = score; }
  }
  return best;
}

/** Western (1,200) or Indian (1,20,000) thousands grouping. Any other use of a comma, such as 49,50, is not a number. */
const GROUPED_NUMBER = /^(\d{1,3}(,\d{3})+|\d{1,2}(,\d{2})+,\d{3})(\.\d+)?$/;

export function parseNumber(value: string): number | null {
  const cleaned = clean(value).replace(/^[₹]\s*/, "").replace(/^(rs\.?|inr)\s*/i, "").replace(/\/-$/, "").trim();
  if (cleaned.includes(",")) { if (!GROUPED_NUMBER.test(cleaned)) return null; }
  const plain = cleaned.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(plain)) return null;
  const number = Number(plain);
  return Number.isFinite(number) ? number : null;
}

/** The largest values the database can hold: price is numeric(12,2), stock is a whole number of packs. */
export const MAX_PRICE = 9_999_999_999.99;
export const MAX_STOCK = 999_999_999;

const UNIT_CELL = /^\d+(\.\d+)?\s*(kg|kgs|g|gm|gms|gram|grams|l|ltr|litre|litres|liter|liters|ml|pc|pcs|piece|pieces|pack|packs|packet|dozen|nos|unit|units|plate|plates|portion|portions|meal|meals|bottle|box|bag|tray)\b/i;
const UNIT_ONLY = /^(kg|g|gm|gram|l|ltr|litre|liter|ml|pc|pcs|piece|pack|packet|dozen|nos|unit|plate|portion|meal|bottle|box|bag|tray)$/i;

const CATEGORY_ALIASES: Record<string, string> = {
  dairy: "Milk & dairy", milk: "Milk & dairy", "milk and dairy": "Milk & dairy", "milk & dairy": "Milk & dairy", curd: "Milk & dairy", paneer: "Milk & dairy",
  meal: "Home food", meals: "Home food", tiffin: "Home food", homefood: "Home food", "home food": "Home food", "home meals": "Home food", "home made": "Home food", homemade: "Home food",
  catering: "Caterer", caterer: "Caterer", "party food": "Caterer",
  meat: "Meat & fish", fish: "Meat & fish", chicken: "Meat & fish", mutton: "Meat & fish", seafood: "Meat & fish", "meat and fish": "Meat & fish", "meat & fish": "Meat & fish",
  vegetable: "Vegetables", vegetables: "Vegetables", veggies: "Vegetables", veg: "Vegetables", fruits: "Vegetables", fruit: "Vegetables", produce: "Vegetables",
  grocery: "Groceries", groceries: "Groceries", provisions: "Groceries", staples: "Rice & staples", rice: "Rice & staples", "rice and staples": "Rice & staples", "rice & staples": "Rice & staples", grains: "Rice & staples", flour: "Rice & staples",
  egg: "Eggs", eggs: "Eggs",
  bakery: "Bakery", bakes: "Bakery", bread: "Bakery", cake: "Bakery", cakes: "Bakery",
  snack: "Snacks", snacks: "Snacks", sweets: "Snacks", savouries: "Snacks",
  other: "Other", others: "Other", misc: "Other", miscellaneous: "Other",
};

/** Maps whatever the vendor typed to one of the real categories; falls back to the given default. */
export function matchCategory(value: string, categories: string[], fallback: string): string {
  const key = clean(value).toLowerCase();
  if (!key) return fallback;
  const exact = categories.find((name) => name.toLowerCase() === key);
  if (exact) return exact;
  const alias = CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.replace(/\s*&\s*/g, " and ")];
  if (alias && categories.includes(alias)) return alias;
  return fallback;
}

/** Veg / Non-veg / Egg only from what the vendor wrote. Anything unclear stays unset. */
export function readFoodType(value: string): FoodType | undefined {
  const key = clean(value).toLowerCase().replace(/[^a-z]/g, "");
  if (!key) return undefined;
  const direct = normalizeFoodType(clean(value).toLowerCase().replace(/[- ]/g, "_"));
  if (direct) return direct;
  if (["veg", "vegetarian", "v", "pureveg", "vegan"].includes(key)) return "veg";
  if (["nonveg", "nonvegetarian", "nv", "nveg", "meat", "chicken", "fish"].includes(key)) return "non_veg";
  if (["egg", "eggs", "containsegg", "withegg", "eggetarian"].includes(key)) return "egg";
  return undefined;
}

function problemsFor(row: { name: string; price: number; stock: number }): string[] {
  const problems: string[] = [];
  if (!row.name) problems.push("Add a name");
  if (!(row.price > 0)) problems.push("Add a price");
  else if (row.price > MAX_PRICE) problems.push("The price is too large");
  else if (Math.abs(Math.round(row.price * 100) - row.price * 100) > 1e-6) problems.push("The price can have at most 2 decimal places");
  if (!(row.stock > 0)) problems.push("Add the pack stock");
  else if (!Number.isInteger(row.stock)) problems.push("Stock must be a whole number of packs");
  else if (row.stock > MAX_STOCK) problems.push("The stock is too large");
  return problems;
}

function finish(row: Omit<CatalogueDraftRow, "problems">): CatalogueDraftRow {
  return { ...row, problems: problemsFor(row) };
}

export function rowProblems(row: Pick<CatalogueDraftRow, "name" | "price" | "stock">): string[] {
  return problemsFor({ name: clean(row.name), price: Number(row.price), stock: Number(row.stock) });
}

export function readCatalogueText(text: string, options: { categories: string[]; defaultCategory: string }): CatalogueReading {
  const { categories, defaultCategory } = options;
  const fallbackCategory = categories.includes(defaultCategory) ? defaultCategory : (categories.includes("Groceries") ? "Groceries" : categories[0] ?? "Other");
  const delimiter = detectDelimiter(text);
  const all = splitDelimited(text, delimiter).map((cells) => cells.map(clean));
  if (!all.length) return { rows: [], structured: false, skipped: 0, truncated: false };

  const mapping: Partial<Record<keyof typeof HEADERS, number>> = {};
  all[0].forEach((cell, index) => { const field = fieldFor(cell); if (field && mapping[field] === undefined) mapping[field] = index; });
  const hasHeader = mapping.name !== undefined && Object.keys(mapping).length >= 2;
  const body = hasHeader ? all.slice(1) : all;
  const truncated = body.length > MAX_IMPORT_ROWS;
  let skipped = 0;
  const rows: CatalogueDraftRow[] = [];
  let sawPrice = false;

  for (const cells of body.slice(0, MAX_IMPORT_ROWS)) {
    if (hasHeader) {
      const at = (field: keyof typeof HEADERS) => (mapping[field] === undefined ? "" : cells[mapping[field]!] ?? "");
      const name = at("name");
      if (!name) { skipped++; continue; }
      const packCell = at("pack");
      const price = parseNumber(at("price")) ?? 0;
      const stockCell = at("stock");
      // A quantity column that holds "5 kg" is really the pack size, not the stock count.
      const stockNumber = parseNumber(stockCell);
      const stockIsPack = stockNumber === null && UNIT_CELL.test(stockCell);
      const pack = packCell || (stockIsPack ? stockCell : "");
      // No stock column at all means 1 pack, as for a plain list. A stock cell that is blank or not a number is missing stock.
      const stock = stockIsPack || mapping.stock === undefined ? 1 : stockNumber ?? 0;
      if (price > 0) sawPrice = true;
      rows.push(finish({ name, category: matchCategory(at("category"), categories, fallbackCategory), pack: pack || "1 pack", price, stock, foodType: readFoodType(at("foodType")) }));
      continue;
    }
    // No header: the first cell is the name; other cells are recognised by what they look like.
    const [first, ...rest] = cells;
    const name = clean(first).replace(/^[-*•\d.)\s]+(?=[A-Za-z\u0080-￿])/, "");
    if (!name || parseNumber(name) !== null) { skipped++; continue; }
    let pack = "";
    const numbers: number[] = [];
    let foodType: FoodType | undefined;
    let category = "";
    for (const cell of rest) {
      if (!cell) continue;
      const number = parseNumber(cell);
      if (number !== null) numbers.push(number);
      else if (UNIT_CELL.test(cell) || UNIT_ONLY.test(cell)) pack = pack || cell;
      else if (readFoodType(cell) && cell.length <= 14) foodType = foodType ?? readFoodType(cell);
      else if (matchCategory(cell, categories, "") && !category) category = matchCategory(cell, categories, "");
    }
    const price = numbers[0] ?? 0;
    if (price > 0) sawPrice = true;
    rows.push(finish({ name, category: category || fallbackCategory, pack: pack || "1 pack", price, stock: numbers[1] ?? 1, foodType }));
  }
  return { rows, structured: hasHeader || sawPrice, skipped, truncated };
}

/** The template a vendor can download, fill in and upload again. */
export const CATALOGUE_TEMPLATE_CSV = [
  "Name,Category,Pack,Price,Stock,Food type",
  "Masala dosa,Home food,1 portion,90,20,Veg",
  "Chicken biryani,Home food,1 complete meal,180,15,Non-veg",
  "Farm eggs,Eggs,Tray of 12 eggs,96,30,Egg",
  "Toor dal,Rice & staples,1 kg,155,40,Veg",
].join("\n") + "\n";
