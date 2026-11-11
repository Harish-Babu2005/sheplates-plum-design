import { test, expect } from "@playwright/test";
import { loginAsStaff, loginAsCustomer, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

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

  test("a signed-out visitor opening a vendor's QR link is prompted to sign in", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/?vendor=${KANDAN_FOODS_ID}`);
    await expect(page.getByText("Customer access")).toBeVisible({ timeout: 10_000 });
  });
});
