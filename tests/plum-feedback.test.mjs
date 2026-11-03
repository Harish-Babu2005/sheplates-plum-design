import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");

test("secondary and outline buttons have dark text, never white on a pale fill", async () => {
  const css = await read("app/design-kit.css");
  assert.match(css, /\.sh \.btn\.sec\{[^}]*color:var\(--ink\)/);
  assert.match(css, /\.sh \.btn\.out\{[^}]*color:var\(--ot\)/);
});

test("the order-date rule no longer blocks status changes, and the 15-day window is enforced on the server", async () => {
  const sql = await read("supabase/migrations/20261103000300_order_date_rule.sql");
  assert.equal(sql, await read("supabase/V9_15_ORDER_DATE_RULE.sql"), "the editor copy matches the migration");
  assert.match(sql, /drop constraint if exists orders_scheduled_date_check/i);
  assert.match(sql, /before insert or update of scheduled_date on public\.orders/i);
  assert.doesNotMatch(sql, /^\s*(delete|update)\s+public\.orders/im, "the file never changes existing orders");
  const route = await read("app/api/commerce/route.ts");
  for (const guard of ["scheduledDate", "startDate", "newDate"]) assert.match(route, new RegExp(`withinOrderWindow\\(${guard}\\)`));
});

test("every customer date picker stops at 15 days and the live delivery slots reach the screen", async () => {
  const app = await read("components/sheplates-v3.tsx");
  assert.ok((app.match(/max=\{latestOrderDate\(\)\}/g) || []).length >= 4, "planning, checkout, new schedule start and schedule edit all have a max");
  assert.match(app, /deliverySlots: VendorDeliverySlot\[\] = snapshot\.deliverySlots/);
  assert.match(app, /\.\.\.current, orders, schedules: mergedSchedules, staff, assignments, thirdPartyDeliveries, cart, deliverySlots/);
});

test("errors from Supabase show their real message instead of a generic one", async () => {
  const source = await read("lib/error-message.ts");
  const { transform } = await import("typescript").then((m) => m.default ?? m).then((ts) => ({ transform: (code) => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText }));
  const mod = await import(`data:text/javascript;base64,${Buffer.from(transform(source)).toString("base64")}`);
  assert.equal(mod.errorMessage(new Error("boom"), "fallback"), "boom");
  assert.equal(mod.errorMessage({ message: "new row violates check constraint", hint: "Try another date" }, "fallback"), "new row violates check constraint · Try another date");
  assert.equal(mod.errorMessage({}, "fallback"), "fallback");
  assert.equal(mod.errorMessage(null, "fallback"), "fallback");
  const app = await read("components/sheplates-v3.tsx");
  assert.doesNotMatch(app, /instanceof Error \? \w+\.message : "/, "no catch block falls back to a generic message for object errors");
});

test("the service worker always answers with a Response", async () => {
  const sw = await read("public/sw.js");
  assert.match(sw, /Response\.error\(\)/);
});

test("schedules that are finished do not offer Pause or Reschedule", async () => {
  const app = await read("components/sheplates-v3.tsx");
  assert.match(app, /const finished = status === "Cancelled" \|\| status === "Completed"/);
  assert.match(app, /\{persisted && !finished \?/);
});

test("the vendor-error diagnostic is read-only", async () => {
  const original = await read("supabase/DIAGNOSE_VENDOR_ERRORS.sql");
  const code = original.replace(/--.*$/gm, "").replace(/'[^']*'/g, "''");
  assert.doesNotMatch(code, /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i);
  assert.match(original, /review_vendor_and_notify/);
});
