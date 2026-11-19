import { test, expect } from "@playwright/test";
import { loginAsStaff, loginAsCustomer, dismissTourIfOpen, openStaffNavIfCollapsed, DEMO } from "./helpers";

// Known seeded vendor with real published products (see DELIVERY_SUMMARY.md).
const KANDAN_FOODS_ID = "118bd5e1-5e05-4c7b-a8f7-1db5c4f0f747";

test.describe("Vendor QR code deep link", () => {
  test("vendor sees a generated QR code with a downloadable image on the storefront page", async ({ page }) => {
    await loginAsStaff(page, "vendor");
    await dismissTourIfOpen(page);
    await openStaffNavIfCollapsed(page);
    await page.getByRole("button", { name: "Online shop & POS" }).click();
    await expect(page.getByText("Your shop QR code")).toBeVisible({ timeout: 10_000 });
    const qrImage = page.locator('img[alt^="QR code for"]');
    await expect(qrImage).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Download QR/ })).toBeVisible();
  });

  test("a signed-in customer opening a vendor's QR link opens that vendor's store profile", async ({ page }) => {
    await loginAsCustomer(page);
    await dismissTourIfOpen(page);
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/Kandan Foods/i).first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(dialog.getByText("Your cart")).toBeVisible();

    // Browser back navigation closes the store profile dialog
    await page.goBack();
    await expect(dialog).not.toBeVisible();
    expect(page.url()).not.toContain(`vendor=${KANDAN_FOODS_ID}`);
  });

  test("a signed-out visitor can browse a vendor store via QR link without signing in", async ({ page }) => {
    // Clear any existing session
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    // Navigate to the QR link as a guest
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);

    // Guest should see the vendor store dialog (NOT be forced to sign in)
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // The store name should be visible
    await expect(dialog.getByText(/Kandan Foods/i).first()).toBeVisible({ timeout: 10_000 });

    // Guest can see the menu tab and browse products
    await expect(dialog.getByRole("button", { name: "Menu" })).toBeVisible();

    // Cart sidebar should be visible (even if empty)
    await expect(dialog.getByText("Your cart")).toBeVisible();
  });

  test("a signed-out visitor clicking Add to Cart is prompted to sign in", async ({ page }) => {
    // Clear session
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    // Open guest store
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/Kandan Foods/i).first()).toBeVisible({ timeout: 10_000 });

    // Click Add on a product — should trigger auth prompt
    const addButton = dialog.getByRole("button", { name: /Add/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // A sign-in prompt should appear (toast or auth dialog)
    const signInPrompt = page.getByText(/sign in|create an account/i).first();
    await expect(signInPrompt).toBeVisible({ timeout: 10_000 });
  });

  test("after signing in from a guest store, customer returns to the same vendor store", async ({ page }) => {
    // Clear session
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    // Open guest store and trigger auth
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/Kandan Foods/i).first()).toBeVisible({ timeout: 10_000 });

    // Click Add to trigger auth
    const addButton = dialog.getByRole("button", { name: /Add/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Complete sign-in
    const emailField = page.getByLabel("Email");
    await expect(emailField).toBeVisible({ timeout: 10_000 });
    await emailField.fill(DEMO.customer.email);
    await page.locator('input[type="password"]').fill(DEMO.customer.password);
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();

    // Wait for profile to load
    await page.waitForSelector('text=Loading your Sheplates profile', { state: "hidden", timeout: 15_000 }).catch(() => { });

    // Vendor store dialog should re-appear with the same vendor
    const postLoginDialog = page.getByRole("dialog");
    await expect(postLoginDialog).toBeVisible({ timeout: 15_000 });
    await expect(postLoginDialog.getByText(/Kandan Foods/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
