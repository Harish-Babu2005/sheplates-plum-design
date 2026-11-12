import { expect, test } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

// Behaviour the testers reported as failing (QA cases AUTH-007, V-ONB-011, V-ONB-025..028), checked in the browser.

test("AUTH-007: pressing Sign in with an empty email and password shows a message and does not crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  // the page may still be hydrating on the first click, so retry until the sign-in form opens
  await expect(async () => {
    await page.getByRole("button", { name: /Customer login|^Sign in$/i }).first().click();
    await expect(page.locator("form")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email and password.")).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe("Vendor onboarding rules", () => {
  const NEW_VENDOR = { email: "qa_chef@sheplates.demo", name: "QA Chef", role: "vendor" as const, toursCompleted: ["vendor_v1"] };
  async function startOnboarding(page: import("@playwright/test").Page) {
    const state = buildDemoState();
    state.vendors = state.vendors.filter((v) => v.ownerEmail !== NEW_VENDOR.email);
    await page.addInitScript(([s, u]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, NEW_VENDOR] as const);
    await page.goto("/");
    await dismissTourIfOpen(page);
    await expect(page.getByText(/Vendor onboarding · 1\/4/i)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Business name").fill("QA Kitchen");
    await page.getByRole("button", { name: /Continue/i }).click();
    await page.getByPlaceholder("Street, landmark, area, city and PIN").fill("12, Test Street, Chennai, 600001");
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByText(/Vendor onboarding · 3\/4/i)).toBeVisible();
  }

  test("V-ONB-011: a store must offer delivery or pickup before the vendor can continue", async ({ page }) => {
    await startOnboarding(page);
    // both are on by default; switch both off
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(2);
    for (const index of [0, 1]) if ((await switches.nth(index).getAttribute("aria-checked")) === "true") await switches.nth(index).click();
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByText("Enable delivery or pickup.")).toBeVisible();
    await expect(page.getByText(/Vendor onboarding · 3\/4/i)).toBeVisible();
    await switches.nth(1).click(); // turn pickup back on
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByText(/Vendor onboarding · 4\/4/i)).toBeVisible();
  });

  test("V-ONB-025..028: PAN, IFSC and bank account are limited, upper-cased and checked as the vendor types", async ({ page }) => {
    await startOnboarding(page);
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByText(/Vendor onboarding · 4\/4/i)).toBeVisible();
    const pan = page.locator("#pan-number-input");
    await pan.fill("abcde1234f12");
    await expect(pan).toHaveValue("ABCDE1234F"); // limited to 10 characters and upper-cased
    await expect(page.getByText("PAN must be 10 characters like ABCDE1234F.")).toHaveCount(0);
    await pan.fill("ABCDE1234");
    await expect(page.getByText("PAN must be 10 characters like ABCDE1234F.")).toBeVisible();
    await page.getByRole("button", { name: "Bank Details", exact: true }).click();
    const account = page.locator("#bank-account-input"), ifsc = page.locator("#bank-ifsc-input");
    await account.fill("ABC12345678");
    await expect(account).toHaveValue("12345678"); // letters are not typed
    await expect(page.getByText("Bank account number must be 9 to 18 digits.")).toBeVisible(); // 8 digits
    await account.fill("1234567890123456789");
    await expect(page.getByText("Bank account number must be 9 to 18 digits.")).toBeVisible(); // 19 digits
    await account.fill("123456789");
    await expect(page.getByText("Bank account number must be 9 to 18 digits.")).toHaveCount(0); // 9 digits
    await expect(page.getByText("Enter both the bank account number and the IFSC code.")).toBeVisible(); // account without IFSC
    await ifsc.fill("hdfc1001234");
    await expect(ifsc).toHaveValue("HDFC1001234");
    await expect(page.getByText("IFSC must be 11 characters like HDFC0001234.")).toBeVisible(); // 5th character is not 0
    await ifsc.fill("hdfc0001234");
    await expect(page.getByText("IFSC must be 11 characters like HDFC0001234.")).toHaveCount(0);
    await expect(page.getByText("Enter both the bank account number and the IFSC code.")).toHaveCount(0);
  });
});
