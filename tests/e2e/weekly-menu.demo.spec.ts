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
  await page.getByRole("button", { name: "Save Veg lunch plan" }).click();
  await expect(page.getByText("The plan price must be between").first()).toBeVisible();
  await page.getByLabel("Plan price per day").fill("120");
  await page.getByLabel("Monday dishes").fill("Rice\nSambar\nCurd\nRice");
  await page.getByRole("button", { name: "Save Veg lunch plan" }).click();
  await expect(page.getByText(/Veg lunch plan saved: 1 day/).first()).toBeVisible();
  // the saved plan stays when the vendor switches meals and comes back
  await page.getByRole("button", { name: "Dinner", exact: true }).click();
  await expect(page.getByLabel("Monday dishes")).toHaveValue("");
  await page.getByRole("button", { name: "Lunch", exact: true }).click();
  await expect(page.getByLabel("Monday dishes")).toHaveValue("Rice\nSambar\nCurd");
  await expect(page.getByLabel("Plan price per day")).toHaveValue("120");
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
    const plan = { id: "plan-veg-lunch", vendorId: "v-meena", name: "Veg lunch plan", category: "Home food", emoji: "🍱", baseUnit: "meal", quantityStep: 1, vendorPrice: 120, stock: 999, active: true, calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, dietaryTags: [], nutritionStatus: "Pending review", foodType: "veg" };
    (state.products as unknown[]).push(plan);
    (state as unknown as { weeklyMenus: unknown[] }).weeklyMenus = [
      { vendorId: "v-meena", weekday: "Mon", meal: "lunch", diet: "veg", dishes: ["Rice", "Sambar"], open: true },
      { vendorId: "v-meena", weekday: "Wed", meal: "lunch", diet: "veg", dishes: ["Chapati", "Dal"], open: true },
      { vendorId: "v-meena", weekday: "Fri", meal: "lunch", diet: "veg", dishes: ["Pulao"], open: false },
    ];
  });
  await page.getByRole("button", { name: "Open Meena's Home Kitchen" }).first().click();
  const dialog = page.getByRole("dialog").first();
  await dialog.getByRole("tab", { name: "Weekly menu" }).click();
  await expect(dialog.getByText("Chapati · Dal")).toBeVisible();
  await expect(dialog.getByText("Pulao")).toHaveCount(0); // switched off by the chef
  await expect(dialog.getByRole("button", { name: /Order this day/ })).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: /Subscribe to the whole week \(2 days\)/ })).toBeVisible();

  // One day: a single delivery on the next Wednesday, never today.
  const wednesday = nextDateForWeekday("Wed", isoDay(1));
  await dialog.getByRole("button", { name: /Order this day/ }).nth(1).click();
  const schedule = page.getByRole("dialog").last();
  const frequency = schedule.getByText("Frequency", { exact: true }).locator("..");
  await expect(schedule.locator('input[type="date"]').first()).toHaveValue(wednesday);
  await expect(frequency).toContainText("Once");
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
});
