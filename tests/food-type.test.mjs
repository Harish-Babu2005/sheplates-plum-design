import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");
const load = async (file) => {
  const out = ts.transpileModule(await read(file), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
};

test("food types are exactly veg, non-veg and egg, and anything else means 'not set'", async () => {
  const { normalizeFoodType, foodTypeLabel, FOOD_TYPES } = await load("lib/food-type.ts");
  assert.deepEqual(FOOD_TYPES.map((t) => t.value), ["veg", "non_veg", "egg"]);
  assert.equal(normalizeFoodType("veg"), "veg");
  assert.equal(normalizeFoodType("non_veg"), "non_veg");
  assert.equal(normalizeFoodType("egg"), "egg");
  for (const bad of [null, undefined, "", "vegan", "Veg", 1]) assert.equal(normalizeFoodType(bad), undefined, String(bad));
  assert.equal(foodTypeLabel("veg"), "Vegetarian");
  assert.equal(foodTypeLabel(undefined), "Food type not set");
});

test("the food type is never guessed from the category", async () => {
  const sources = await Promise.all(["lib/food-type.ts", "components/food-type-mark.tsx", "lib/supabase.ts"].map(read));
  for (const source of sources) assert.doesNotMatch(source, /category[^;\n]{0,60}(veg|non_veg|egg)\b.*=>|categoryToFoodType|guessFoodType/i);
  const app = await read("components/sheplates-v3.tsx");
  assert.match(app, /if \(!foodType\) return toast\.error\("Choose Vegetarian, Non-vegetarian or Contains egg"\)/);
  assert.match(app, /disabled=\{!baseReady \|\| !foodTypeReady \|\| busy\}/);
  assert.match(app, /useState<FoodType \| "">\(""\)/, "no default is chosen for the vendor");
});

test("the mark uses the label green for vegetarian, a different shape and colour otherwise, and speaks its meaning", async () => {
  const mark = await read("components/food-type-mark.tsx");
  assert.match(mark, /const GREEN = "#247343"/);
  assert.match(mark, /role="img"/);
  assert.match(mark, /aria-label=\{foodTypeLabel\(type\)\}/);
  assert.match(mark, /<circle/);
  assert.match(mark, /<path d="M8 4 12\.2 11\.5H3\.8Z"/);
  assert.match(mark, /if \(!type\) return null/, "no mark while the type is unset");
});

test("the database change is additive, safe, and respects who may see what", async () => {
  const sql = await read("supabase/V9_18_FOOD_TYPE.sql");
  assert.equal(sql, await read("supabase/migrations/20261104000200_food_type.sql"), "the editor copy matches the migration");
  assert.match(sql, /add column if not exists food_type text check \(food_type in \('veg', 'non_veg', 'egg'\)\)/);
  assert.match(sql, /security definer set search_path = public/);
  assert.match(sql, /public\.owns_vendor\(m\.vendor_id\)/);
  assert.match(sql, /m\.active and v\.verification_status = 'verified' and v\.marketplace_visible/);
  assert.match(sql, /grant execute on function public\.product_food_types\(uuid\[\]\) to anon, authenticated/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\b(update|delete)\s+public\./i, "no existing product is changed");
});

test("the data layer survives a database that does not have the column yet", async () => {
  const data = await read("lib/supabase.ts");
  assert.match(data, /rpc\("product_food_types"/);
  assert.match(data, /catch \{ \/\* not deployed yet \*\/ \}/);
  assert.match(data, /\/food_type\/i\.test\(result\.error\.message \|\| ""\)\) result = await supabase\.from\("vendor_menu_items"\)\.insert\(basePayload\)/);
  assert.match(data, /export async function saveLiveProductFoodType/);
  assert.equal((data.match(/await attachFoodTypes\(/g) || []).length, 3, "marketplace, vendor and staff loaders");
});

test("marks and the green rating badge are on every customer product view", async () => {
  const app = await read("components/sheplates-v3.tsx");
  assert.ok((app.match(/<FoodTypeMark type=\{product\.foodType\}/g) || []).length >= 5, "marketplace row, wishlist, cart, AI picks, vendor catalogue");
  assert.match(await read("components/customer-v2/profile.tsx"), /<FoodTypeMark type=\{product\.foodType\}/);
  assert.match(await read("app/design-kit.css"), /\.sh \.rate\{[^}]*background:var\(--label-green\);color:#fff/);
  assert.match(await read("app/theme-2.css"), /--label-green: #247343/);
});
