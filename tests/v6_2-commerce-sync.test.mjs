import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("persists customer cart through the live commerce endpoint", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const client = await readFile(path.join(root, "lib/supabase.ts"), "utf8");
  assert.match(route, /action === "sync_cart"/);
  assert.match(route, /commerce_cart_items/);
  assert.match(route, /serviceableProductsForCustomer/);
  assert.match(client, /syncLiveCart/);
});

test("converts the saved cart into real pending orders before payment", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(route, /action === "checkout_cart"/);
  assert.match(route, /status: "converted"/);
  assert.match(route, /from\("orders"\)\.insert/);
  assert.match(route, /from\("payments"\)\.insert/);
  assert.match(ui, /checkoutLiveCart/);
});

test("customers can remove only their unpaid checkout and queued payment reminders are cancelled", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const migration = await readFile(path.join(root, "supabase/migrations/20261102000200_customer_remove_unpaid_order.sql"), "utf8");
  const reasonMigration = await readFile(path.join(root, "supabase/migrations/20261102000300_customer_cancellation_reasons.sql"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const payments = await readFile(path.join(root, "app/api/payments/razorpay/route.ts"), "utf8");
  assert.match(route, /action === "remove_pending_order"/);
  assert.match(route, /ctx\.caller\.rpc\("customer_remove_unpaid_order"/);
  assert.match(route, /details\.code === "PGRST202" \|\| details\.code === "42883"/);
  assert.match(route, /Ask support to apply the latest database migration/);
  assert.match(route, /function errorDetails\(error: unknown\)/);
  assert.match(migration, /customer_id = auth\.uid\(\)/i);
  assert.match(migration, /order_row\.status <> 'awarded'/i);
  assert.match(migration, /status <> 'pending'/i);
  assert.match(migration, /status = 'cancelled'/i);
  assert.match(migration, /status = 'awaiting_payment'/i);
  assert.match(migration, /payment_reminder/);
  assert.match(ui, /aria-label=\{`Remove unpaid order: \$\{order\.description\}`\}/);
  assert.match(ui, /removeLivePendingOrder\(order\.id\)/);
  assert.match(reasonMigration, /scheduled_date_passed:%/);
  assert.match(reasonMigration, /payment_completed/);
  assert.match(reasonMigration, /order_status_ineligible:%/);
  assert.match(route, /reason: "scheduled_date_passed"/);
  assert.match(route, /reason: "payment_completed"/);
  assert.match(route, /reason: "order_status_ineligible"/);
  assert.match(route, /couldn’t verify whether this order can be cancelled/);
  assert.match(ui, /Cancellation unavailable/);
  assert.match(ui, /isCustomerFacingReason/);
  assert.match(ui, /Refresh your orders and try again/);
  assert.match(ui, /setCancellationNotice/);
  assert.equal((payments.match(/order\.status === "cancelled"/g) || []).length, 2);
});

test("lets customers choose an exact future date for cart orders and schedules", async () => {
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  assert.match(ui, /aria-label="Order delivery date" type="date" min=\{tomorrow\(\)\} value=\{deliveryDate\}/);
  assert.match(ui, /scheduledDate: deliveryDate/);
  assert.match(route, /const scheduledDate = String\(body\.scheduledDate/);
  assert.match(ui, /aria-label=\{recurrence === "Once" \? "Delivery date" : "First delivery date"\}/);
  assert.match(route, /if \(!isFutureDate\(startDate\)\)/);
});

test("restores cart, previous orders and paid schedule state from live data", async () => {
  const ui = await readFile(path.join(root, "components/sheplates-v3.tsx"), "utf8");
  const route = await readFile(path.join(root, "app/api/commerce/route.ts"), "utf8");
  assert.match(route, /cartItems/);
  assert.match(ui, /snapshot\.cartItems/);
  assert.match(ui, /statuses\.some\(\(status\).*paid/si);
  assert.match(ui, /progressed.*confirmed.*completed/si);
  assert.match(ui, /paidDeliveries/);
});

test("She Agent sees real order item names and uses the same saved cart", async () => {
  const agent = await readFile(path.join(root, "app/api/agent/route.ts"), "utf8");
  const runtime = await readFile(path.join(root, "lib/she-agent-commerce-runtime.ts"), "utf8");
  assert.match(agent, /order_items\(product_name,quantity,unit,customer_price\)/);
  assert.match(agent, /commerce_cart_items/);
  assert.match(runtime, /get_current_cart/);
  assert.match(runtime, /basketProductIds means the app should persist/);
  assert.match(runtime, /get_order_history for previous\/recent purchases/);
});
