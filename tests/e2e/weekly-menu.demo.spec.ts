import { expect, test, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { nextDateForWeekday } from "../../lib/weekly-menu";

const VENDOR = { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] };
const BAKERY = { email: "v-abc@sheplates.demo", name: "ABC", role: "vendor", toursCompleted: ["vendor_v1"] };
const CUSTOMER = { email: "customer@sheplates.demo", name: "Raj", role: "customer", toursCompleted: ["customer_v1"] };

async function openAs(page: Page, session: object, tweak?: (s: ReturnType<typeof buildDemoState>) => void) {
  const state = buildDemoState(); tweak?.(state);
  await page.addInitScript(([s, u]) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); sessionStorage.setItem("seeded", "1"); } }, [state, session] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app, [data-tour]", { timeout: 30_000 });
}
async function openNav(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: new RegExp(`^${name}\\s*\\d*$`) }).click();
}
const isoDay = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toLocaleDateString("en-CA"); };

test("a home kitchen prices a plan, writes each day's dishes and saves; other vendor types have no weekly menu", async ({ page }) => {
  await openAs(page, VENDOR);
  await openNav(page, "Weekly menu");
  await expect(page.getByRole("heading", { name: "Weekly menu" })).toBeVisible();
  await page.getByLabel("Monday dishes").fill("Rice\nSambar\nCurd\nRice");
  await page.getByRole("button", { name: "Save Veg lunch plan" }).click();
  await expect(page.getByText(/Monday: enter a price between/).first()).toBeVisible(); // a cooking day needs its own price
  await page.getByLabel("Monday price").fill("120");
  await page.getByLabel("Tuesday dishes").fill("Chapati\nDal");
  await page.getByLabel("Tuesday price").fill("150");
  await page.getByRole("button", { name: "Save Veg lunch plan" }).click();
  await expect(page.getByText(/Veg lunch plan saved: 2 days/).first()).toBeVisible();
  // the saved plan, with each day's own price, stays when the vendor switches meals and comes back
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(page.getByLabel("Monday dishes")).toHaveValue("");
  await page.getByRole("button", { name: "Lunch", exact: true }).click();
  await expect(page.getByLabel("Monday dishes")).toHaveValue("Rice\nSambar\nCurd");
  await expect(page.getByLabel("Monday price")).toHaveValue("120");
  await expect(page.getByLabel("Tuesday price")).toHaveValue("150");
  // one price for all days, still adjustable per day
  await page.getByLabel("Same price for all days").fill("99");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByLabel("Tuesday price")).toHaveValue("99");
});

test("a bakery does not get the weekly menu", async ({ page }) => {
  await openAs(page, BAKERY);
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await expect(page.locator("aside.k-side nav").getByRole("button", { name: /^Catalog/ })).toBeVisible();
  await expect(page.locator("aside.k-side nav").getByRole("button", { name: /Weekly menu/ })).toHaveCount(0);
});

test("a customer sees the week, and one day, a weekday, or the whole week open the order dialog with the right dates", async ({ page }) => {
  await openAs(page, CUSTOMER, (state) => {
    const plan = { id: "plan-veg-lunch", vendorId: "v-meena", name: "Veg lunch plan", category: "Home food", emoji: "🍱", baseUnit: "meal", quantityStep: 1, vendorPrice: 100, stock: 999, active: true, calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, dietaryTags: [], nutritionStatus: "Pending review", foodType: "veg" };
    (state.products as unknown[]).push(plan);
    (state as unknown as { weeklyMenus: unknown[] }).weeklyMenus = [
      { vendorId: "v-meena", weekday: "Mon", meal: "lunch", diet: "veg", dishes: ["Rice", "Sambar"], open: true, price: 100 },
      { vendorId: "v-meena", weekday: "Wed", meal: "lunch", diet: "veg", dishes: ["Chapati", "Dal"], open: true, price: 150 },
      { vendorId: "v-meena", weekday: "Fri", meal: "lunch", diet: "veg", dishes: ["Pulao"], open: false },
    ];
  });
  await page.getByRole("button", { name: "Open Meena's Home Kitchen" }).first().click();
  const dialog = page.getByRole("dialog").first();
  await dialog.getByRole("tab", { name: "Weekly menu" }).click();
  await expect(dialog.getByText("Chapati · Dal")).toBeVisible();
  await expect(dialog.getByText("Pulao")).toHaveCount(0); // switched off by the chef
  await expect(dialog.getByText("₹100", { exact: true })).toBeVisible();
  await expect(dialog.getByText("₹150", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Order this day/ })).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: /Subscribe to the whole week \(2 days\) · ₹250 a week/ })).toBeVisible();

  // One day: a single delivery on the next Wednesday, never today.
  const wednesday = nextDateForWeekday("Wed", isoDay(1));
  await dialog.getByRole("button", { name: /Order this day/ }).nth(1).click();
  const schedule = page.getByRole("dialog").last();
  const frequency = schedule.getByText("Frequency", { exact: true }).locator("..");
  await expect(schedule.locator('input[type="date"]').first()).toHaveValue(wednesday);
  await expect(frequency).toContainText("Once");
  // Wednesday costs its own price, and the bill adds that delivery's GST and delivery fee on top
  await expect(schedule.getByText("Product price per delivery", { exact: true }).locator("..")).toContainText("₹150");
  await expect(schedule.getByText(/^GST/).first()).toBeVisible();
  await expect(schedule.getByText(/^Delivery fee per delivery/).first()).toBeVisible();
  const allIncluded = await schedule.getByText("Per delivery, all included", { exact: true }).locator("..").innerText();
  expect(Number(allIncluded.replace(/[^\d.]/g, "").replace(/^\D*/, "")) ).toBeGreaterThan(150);
  await schedule.getByRole("button", { name: "Close" }).click();

  // The same weekday every week.
  await dialog.getByRole("button", { name: "Every Wed" }).click();
  await expect(page.getByRole("dialog").last().locator('input[type="date"]').first()).toHaveValue(wednesday);
  await expect(page.getByRole("dialog").last().getByText("Frequency", { exact: true }).locator("..")).toContainText("Weekly");
  await page.getByRole("dialog").last().getByRole("button", { name: "Close" }).click();

  // The whole week: only the days the chef is cooking, starting at the earliest of them from tomorrow.
  const first = [nextDateForWeekday("Mon", isoDay(1)), wednesday].sort()[0];
  await dialog.getByRole("button", { name: /Subscribe to the whole week/ }).click();
  const week = page.getByRole("dialog").last();
  await expect(week.locator('input[type="date"]').first()).toHaveValue(first);
  await expect(week.getByText("Frequency", { exact: true }).locator("..")).toContainText("Custom");
  await expect(week.getByText("Total to activate schedule", { exact: true }).locator("..")).toContainText("₹"); // sum of each cooking day, within the 30 day window
});

test("the vendor's order screen shows the dishes promised for that day", async ({ page }) => {
  await openAs(page, VENDOR, (state) => {
    const base = state.orders.find((o) => o.vendorId === "v-meena")!;
    (state.orders as unknown[]).unshift({ ...base, id: "ORD-PLAN-1", orderNumber: "SP-PLAN1", description: "Veg lunch plan · Wed: Chapati, Dal", productId: undefined, status: "Confirmed", payment: "Paid" });
  });
  await openNav(page, "Orders");
  await expect(page.getByText("Veg lunch plan · Wed: Chapati, Dal").first()).toBeVisible();
});
