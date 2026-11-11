import { expect, test } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";

const ADMIN = { email: "admin@sheplates.demo", name: "Admin", role: "admin", toursCompleted: ["admin_v1"] };

// Smoke test for the Super Admin screen: a hook used to sit after the early returns (a React rules violation that could crash the page when the pages switch). It is now above them.
test("Super Admin can move between the overview and other pages without the screen crashing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [buildDemoState(), ADMIN] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
  const open = async (name: RegExp) => {
    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
    await page.locator("aside.k-side nav").getByRole("button", { name }).click();
  };
  for (const [page2, back] of [[/^Audit log/, /^Executive view/], [/^Reports/, /^Executive view/], [/^Vendor plans/, /^Executive view/]] as const) {
    await open(page2);
    await open(back);
    await expect(page.locator(".k-app")).toBeVisible();
  }
  expect(errors.filter((m) => /hook|Rendered (more|fewer)/i.test(m))).toEqual([]);
});
