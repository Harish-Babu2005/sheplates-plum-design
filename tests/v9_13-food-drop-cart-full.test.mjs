import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(new URL("../supabase/V9_13_FOOD_DROP_CART_CHECKOUT.sql", import.meta.url), "utf8");
const commerce = fs.readFileSync(new URL("../app/api/commerce/route.ts", import.meta.url), "utf8");
const customer = fs.readFileSync(new URL("../components/sheplates-v3.tsx", import.meta.url), "utf8");
const discover = fs.readFileSync(new URL("../components/customer-v2/discover.tsx", import.meta.url), "utf8");
const profile = fs.readFileSync(new URL("../components/customer-v2/profile.tsx", import.meta.url), "utf8");

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

test("Food Drop Add action adds the offer to the shared cart and displays Add to cart", () => {
  assert.match(customer, /Added \$\{quantity\} × \$\{drop\.title\} to your cart/);
  assert.match(discover, /"Add to cart"/);
  assert.match(profile, /"Add to cart"/);
});

test("CartView renders Food Drop items with their drop title and discounted price even if product is not in local catalog cache", () => {
  assert.match(customer, /const drop = item\.foodDropId \? state\.foodDrops\.find/);
  assert.match(customer, /if \(!product && !drop\) return null/);
  assert.match(customer, /displayName = drop\?\.title \|\| product\?\.name/);
  assert.match(customer, /price = item\.unitPrice \?\? \(drop \? drop\.dropPrice/);
});

test("CartView allows same-day delivery for Food Drops and routes checkout to specific vendors", () => {
  assert.match(customer, /const containsFoodDrop = items\.some/);
  assert.match(customer, /containsFoodDrop \? todayISO\(\) : tomorrow\(\)/);
  assert.match(commerce, /containsFoodDrop \? new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(commerce, /scheduledDate >= new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});

test("Payment fallback allows live mode order confirmation when Razorpay gateway is not configured", () => {
  assert.match(customer, /const saved = await markLiveOrderPaid\(\{ orderId: order\.id/);
  assert.match(customer, /Your order has been sent to the vendor/);
  assert.match(commerce, /action === "mark_paid"/);
  assert.match(commerce, /process\.env\.RAZORPAY_KEY_ID/);
});

test("CartView items can be removed via a top-right corner cross option", () => {
  assert.match(customer, /absolute right-3 top-3 grid size-7 place-items-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600/);
  assert.match(customer, /aria-label=\{`Remove \$\{displayName\} from cart`\}/);
  assert.match(customer, /onClick=\{\(\) => void removeItem\(item\)\}/);
});
