import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/V9_13_FOOD_DROP_CART_CHECKOUT.sql", import.meta.url), "utf8");
const commerce = fs.readFileSync(new URL("../app/api/commerce/route.ts", import.meta.url), "utf8");
const customer = fs.readFileSync(new URL("../components/sheplates-v3.tsx", import.meta.url), "utf8");
const discover = fs.readFileSync(new URL("../components/customer-v2/discover.tsx", import.meta.url), "utf8");

test("Food Drop cart items retain their drop identity in the commerce cart", () => {
  assert.match(migration, /add column if not exists food_drop_id uuid/i);
  assert.match(migration, /references public\.food_drops\(id\)/i);
  assert.match(commerce, /food_drop_id: item\.foodDropId/);
  assert.match(commerce, /food_drop_id: item\.foodDropId \|\| null/);
  assert.match(customer, /foodDropId: row\.food_drop_id/);
});

test("Food Drop checkout reserves stock at checkout and creates discounted vendor orders", () => {
  assert.match(migration, /function public\.claim_food_drops\(p_drop_ids uuid\[\], p_quantities int\[\]\)/i);
  assert.match(commerce, /rpc\("claim_food_drops"/);
  assert.match(commerce, /drop\.drop_price/);
  assert.match(commerce, /grouped\.get\(String\(product\.vendor_id\)\)/);
  assert.match(commerce, /food_drop_id/);
});

test("Food Drop Add action adds the offer to the shared cart", () => {
  assert.match(customer, /Added \$\{quantity\} × \$\{drop\.title\} to your cart/);
  assert.match(discover, /"Add to cart"/);
});
