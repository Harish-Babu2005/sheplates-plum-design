import { expect, test, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

const SESSIONS = {
  customer: { email: "customer@sheplates.demo", name: "Raj", role: "customer", toursCompleted: ["customer_v1"] },
  admin: { email: "admin@sheplates.demo", name: "Admin", role: "admin", toursCompleted: ["admin_v1"] },
};

async function openAs(page: Page, who: keyof typeof SESSIONS | null, tweak?: (state: ReturnType<typeof buildDemoState>) => void) {
  const state = buildDemoState();
  tweak?.(state);
  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    if (u) localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, who ? SESSIONS[who] : null] as const);
  await page.goto("/");
}

/** WCAG contrast ratio between a button's text colour and the colour painted behind it. */
async function contrast(page: Page, locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]: number[]) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const text = parse(getComputedStyle(el).color);
    let node: Element | null = el;
    let bg = [255, 255, 255];
    while (node) { const c = parse(getComputedStyle(node).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) { bg = c; break; } node = node.parentElement; }
    const [a, b] = [lum(text), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}

test("landing page secondary buttons are readable", async ({ page }) => {
  await openAs(page, null);
  for (const name of ["Sign in", "Explore Marketplace", "Try She Agent"]) {
    const button = page.getByRole("button", { name }).first();
    await expect(button).toBeVisible();
    expect(await contrast(page, button), `${name} contrast`).toBeGreaterThan(4.5);
  }
});

test("customer date pickers stop 15 days from today and Plan buttons are readable", async ({ page }) => {
  await openAs(page, "customer", (state) => {
    state.cart = [{ id: "cart-1", customerEmail: "customer@sheplates.demo", productId: "p-1", quantity: 1 }] as unknown as typeof state.cart;
  });
  await dismissTourIfOpen(page);
  const plan = page.getByRole("button", { name: "Plan", exact: true }).first();
  if (await plan.count()) expect(await contrast(page, plan), "Plan contrast").toBeGreaterThan(4.5);
  await page.getByRole("button", { name: /^Cart/ }).first().click();
  const date = page.getByLabel("Order delivery date");
  await expect(date).toBeVisible();
  const [min, max] = await Promise.all([date.getAttribute("min"), date.getAttribute("max")]);
  const days = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${new Date().toLocaleDateString("en-CA")}T00:00:00Z`)) / 86_400_000);
  expect(days(min!)).toBe(1);
  expect(days(max!)).toBe(15);
});

test("the floating agent button is hidden on the She Agent page", async ({ page }) => {
  await openAs(page, "customer");
  await dismissTourIfOpen(page);
  await expect(page.locator("[data-tour='agent-desktop']")).toHaveCount(1);
  await page.getByRole("button", { name: "Open She Agent" }).first().click();
  await expect(page.getByRole("heading", { name: "She Agent" })).toBeVisible();
  await expect(page.locator("[data-tour='agent-desktop']")).toHaveCount(0);
});

test("the Connect vendor form stacks every label above its field", async ({ page }) => {
  await openAs(page, "admin");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: /^P0 Connect vendors\s*\d*$/ }).click();
  const field = page.locator("label", { hasText: "Business name" }).first();
  await expect(field).toBeVisible();
  const [label, input] = await Promise.all([field.boundingBox(), field.locator("input").boundingBox()]);
  expect(input!.y).toBeGreaterThan(label!.y + 8);
  expect(input!.width).toBeGreaterThan(160);
  await field.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator("form", { has: field }).screenshot({ path: `qa-screenshots/redesign/plum-feedback-connect-form-${test.info().project.name}.png` });
});

const VENDOR = { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] };

test("Operations cannot approve a vendor that has not accepted the Vendor Terms", async ({ page }) => {
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); },
    [(() => { const state = buildDemoState(); state.vendors[0] = { ...state.vendors[0], verification: "Submitted", termsAccepted: false } as typeof state.vendors[0]; return state; })(), { email: "operations@sheplates.demo", name: "Ops", role: "operations", toursCompleted: ["operations_v1"] }] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: /^Vendor verification\s*\d*$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "has not accepted the Vendor Terms" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ask for changes" })).toBeEnabled();
});

test("a vendor who has not accepted the terms sees the card on Verification and can sign online", async ({ page }) => {
  const state = buildDemoState();
  state.vendors = state.vendors.map((v) => v.ownerEmail === VENDOR.email ? { ...v, termsAccepted: false } : v);
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, VENDOR] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: /^Verification\s*\d*$/ }).click();
  const card = page.getByRole("region", { name: "Vendor Terms and Conditions" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Review and sign" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign your agreements" });
  await expect(dialog).toBeVisible();
  // Nothing can be sent until both documents are opened, a name is typed and a signature is drawn.
  await expect(dialog.getByRole("button", { name: "Email me a code" })).toBeDisabled();
  for (let i = 0; i < 2; i++) await dialog.getByRole("button", { name: "Read here" }).first().click(); // each opened document turns its button into "Hide"
  await dialog.getByLabel("Full name").fill("Meena Devi");
  const pad = dialog.getByTestId("signature-pad");
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40); await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(box.x + 20 + i * 8, box.y + 40 + (i % 5) * 12);
  await page.mouse.up();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Email me a code" }).click();
  await dialog.getByTestId("signing-code").fill("000000");
  await dialog.getByRole("button", { name: "Sign both documents" }).click();
  await expect(dialog).toBeVisible(); // a wrong code does not sign
  await dialog.getByTestId("signing-code").fill("123456");
  await dialog.getByRole("button", { name: "Sign both documents" }).click();
  await expect(card).toHaveCount(0);
});

test("a vendor can also sign by hand: download both documents, upload a signed copy, and see it wait for Operations", async ({ page }) => {
  const state = buildDemoState();
  state.vendors = state.vendors.map((v) => v.ownerEmail === VENDOR.email ? { ...v, termsAccepted: false } : v);
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, VENDOR] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: /^Verification\s*\d*$/ }).click();
  const card = page.getByRole("region", { name: "Vendor Terms and Conditions" });
  await card.getByRole("button", { name: "Sign by hand and upload" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign your agreements" });
  await expect(dialog.getByRole("tab", { name: "Sign by hand and upload" })).toHaveAttribute("aria-selected", "true");
  const manual = dialog.getByTestId("manual-signing");
  // both documents can be downloaded, and nothing can be uploaded until a file is chosen
  await expect(manual.getByRole("link", { name: "Download to sign" })).toHaveCount(2);
  await expect(manual.getByRole("link", { name: "Download to sign" }).first()).toHaveAttribute("href", /partnership-agreement/);
  await expect(manual.getByRole("button", { name: "Upload signed copy" }).first()).toBeDisabled();
  await manual.getByLabel("Signed Vendor Partnership Agreement").setInputFiles({ name: "agreement-signed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 signed") });
  await manual.getByRole("button", { name: "Upload signed copy" }).first().click();
  await expect(manual.getByText("Uploaded, waiting for Operations")).toHaveCount(1);
  // the other document is still to do, and the online route is one click away
  await expect(manual.getByText("Not signed")).toHaveCount(1);
  await dialog.getByRole("tab", { name: "Sign online" }).click();
  await expect(dialog.getByRole("button", { name: "Email me a code" })).toBeDisabled();
});
