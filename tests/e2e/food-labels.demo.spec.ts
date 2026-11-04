import { expect, test, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

const CUSTOMER = { email: "customer@sheplates.demo", name: "Raj", role: "customer", toursCompleted: ["customer_v1"] };
const VENDOR = { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] };

async function open(page: Page, user: typeof CUSTOMER, tweak?: (state: ReturnType<typeof buildDemoState>) => void) {
  const state = buildDemoState(); tweak?.(state);
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, user] as const);
  await page.goto("/");
  await page.waitForSelector(user.role === "customer" ? ".k-head, .k-pill" : ".k-app", { timeout: 30_000 });
  if (user.role === "customer") await dismissTourIfOpen(page);
}

test("customers see a veg or non-veg mark and a green rating badge on products", async ({ page }) => {
  await open(page, CUSTOMER);
  await page.getByPlaceholder(/Search food, vendor/).first().click();
  await page.keyboard.type("rice");
  await page.keyboard.press("Enter");
  const marks = page.getByRole("img", { name: "Vegetarian" });
  await expect(marks.first()).toBeVisible();
  const mark = await marks.first().evaluate((el) => ({ stroke: el.querySelector("rect")?.getAttribute("stroke"), label: el.getAttribute("aria-label") }));
  expect(mark.stroke).toBe("#247343");
  const badge = page.locator(".sh .rate").first();
  if (await badge.count()) {
    const style = await badge.evaluate((el) => getComputedStyle(el as HTMLElement));
    expect(style.backgroundColor).toBe("rgb(36, 115, 67)");
    expect(style.color).toBe("rgb(255, 255, 255)");
  }
});

test("a non-vegetarian product shows the brown mark", async ({ page }) => {
  await open(page, CUSTOMER);
  await page.getByPlaceholder(/Search food, vendor/).first().click();
  await page.keyboard.type("biryani");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("img", { name: "Non-vegetarian" }).first()).toBeVisible();
});

test("a vendor must choose the food type, and can set it for existing products", async ({ page }) => {
  await open(page, VENDOR, (state) => { state.products = state.products.map((p, i) => i === 0 ? ({ ...p, foodType: undefined } as unknown as typeof p) : p); });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: /^Catalog(ue)?\s*\d*$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "no food type yet" })).toBeVisible();
  await expect(page.getByLabel(/^Food type of /).first()).toBeVisible();
  await page.getByRole("button", { name: "Add product pack" }).click();
  await expect(page.getByRole("radiogroup", { name: "Food type" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish product pack" })).toBeDisabled();
});
