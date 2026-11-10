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

test("fetchWithDeadline gives up on a server that never answers and reports it plainly", async () => {
  const { fetchWithDeadline, DeadlineError } = await load("lib/fetch-deadline.ts");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  try {
    await assert.rejects(fetchWithDeadline("/never", {}, 30), (error) => error instanceof DeadlineError && /taking longer than expected/.test(error.message));
  } finally { globalThis.fetch = realFetch; }
});

test("fetchWithDeadline passes a normal answer through untouched", async () => {
  const { fetchWithDeadline } = await load("lib/fetch-deadline.ts");
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("ok");
  try { assert.equal(await (await fetchWithDeadline("/fine", {}, 1000)).text(), "ok"); } finally { globalThis.fetch = realFetch; }
});

test("She Agent: every model call has a deadline, the written analysis falls back to a reading of the numbers, and prompts are capped", async () => {
  const route = await read("app/api/agent/route.ts");
  assert.match(route, /AbortSignal\.timeout\(MODEL_WAIT_MS\)/);
  assert.match(route, /function businessSnapshot\(/);
  assert.match(route, /if \(body\.task === "business_insights"\) return businessSnapshot\(body\)/);
  assert.match(route, /function compactContext\(/);
  assert.match(route, /Authorised context: \$\{compactContext\(effectiveContext\)\}/);
  assert.doesNotMatch(route, /reasoning\s*:\s*\{\s*effort\s*:\s*"low"\s*\}/);
  const runtime = await read("lib/she-agent-commerce-runtime.ts");
  assert.equal((runtime.match(/signal: AbortSignal\.timeout\(MODEL_CALL_TIMEOUT_MS\)/g) || []).length, 2, "both the plain and the streaming model call");
  assert.doesNotMatch(runtime, /reasoning\s*:\s*\{\s*effort\s*:\s*"low"\s*\}/);
  const app = await read("components/sheplates-v3.tsx");
  assert.match(app, /const deadline = window\.setTimeout\(\(\) => controller\.abort\(\), 90000\)/, "the chat window gives up too");
  assert.equal((app.match(/fetchWithDeadline\("\/api\/agent"/g) || []).length >= 4, true, "insights, narrative, campaigns and nutrition");
});

test("Catalogue: delete uses the V9_19 function, falls back to a plain delete, then to taking the item off sale", async () => {
  const sql = await read("supabase/V9_19_VENDOR_DELETE_PRODUCT.sql");
  assert.equal(sql, await read("supabase/migrations/20261104000300_vendor_delete_product.sql"));
  assert.match(sql, /owns_vendor\(v_vendor\) or public\.current_app_role\(\) in \('operations', 'admin'\)/, "only the store owner or staff");
  assert.match(sql, /delete from public\.commerce_cart_items where menu_item_id = p_item_id/);
  assert.match(sql, /grant execute on function public\.vendor_delete_menu_item\(uuid\) to authenticated/);
  assert.doesNotMatch(sql, /to anon/);
  const lib = await read("lib/supabase.ts");
  const start = lib.indexOf("export async function deleteLiveVendorProduct");
  const body = lib.slice(start, start + 2200);
  assert.ok(body.indexOf('rpc("vendor_delete_menu_item"') < body.indexOf('.delete().eq("id", productId)'));
  assert.ok(body.indexOf('.delete().eq("id", productId)') < body.indexOf('direct.error.code === "23503"'));
  const app = await read("components/sheplates-v3.tsx");
  assert.match(app, /Delete this product\?/);
  assert.match(app, /setLiveProductActive\(product\.id, value\)/, "the Active switch now saves");
});

test("Store & radius: the map is in the same card as the address and radius, and the page cannot be stretched by long suggestions", async () => {
  const app = await read("components/sheplates-v3.tsx");
  const card = app.slice(app.indexOf('data-testid="store-location-card"'), app.indexOf('data-testid="store-location-card"') + 2600);
  assert.ok(card.indexOf("Full store address") < card.indexOf('data-testid="store-map"'));
  assert.ok(card.indexOf('data-testid="store-map"') < card.indexOf("Supply radius"));
  assert.match(app, /min-w-0 max-w-full space-y-1 overflow-hidden rounded-2xl border border-stone-200 bg-white\/95/, "suggestions are clipped to the card");
});

test("Food Drops: a database refusal is explained, whole units only, and the demo can create one", async () => {
  const lib = await read("lib/supabase.ts");
  assert.match(lib, /vendor_has_entitlement/);
  assert.match(lib, /does not include Food Drops/);
  const app = await read("components/sheplates-v3.tsx");
  assert.match(app, /Enter a whole number of units available/);
  assert.match(app, /isLiveSupabaseMode\(\)\s*\?\s*await createLiveFoodDrop/);
  assert.match(app, /if \(isLiveSupabaseMode\(\)\) await cancelLiveFoodDrop/);
});

test("Basket: a database without the Food Drop column still loads and saves ordinary baskets", async () => {
  const route = await read("app/api/commerce/route.ts");
  assert.match(route, /\/food_drop_id\/i\.test\(items\.error\.message/);
  assert.match(route, /\.\.\.\(item\.foodDropId \? \{ food_drop_id: item\.foodDropId \} : \{\}\)/);
  assert.match(route, /in\("document_type", \["food_certificate", "fssai"\]\)/, "resubmitting only touches the FSSAI row");
});
