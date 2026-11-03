import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

const NEW_VENDOR = {
  email: "newchef@sheplates.demo",
  name: "Chef Ananya",
  role: "vendor" as const,
  toursCompleted: ["vendor_v1"],
};

const OPS_SESSION = {
  email: "ops@sheplates.demo",
  name: "Operations Admin",
  role: "operations" as const,
  toursCompleted: ["operations_v1"],
};

async function openAsNewVendor(page: Page) {
  const state = buildDemoState();
  // Ensure this email has no existing vendor so onboarding triggers
  state.vendors = state.vendors.filter((v) => v.ownerEmail !== NEW_VENDOR.email);
  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, NEW_VENDOR] as const);
  await page.goto("/");
}

async function openAsOps(page: Page) {
  const state = buildDemoState();
  await page.addInitScript(([s, u]) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [state, OPS_SESSION] as const);
  await page.goto("/");
}

test.describe("Vendor Onboarding Terms & Conditions Integration", () => {
  test("Vendor must review and accept Terms & Conditions before submitting onboarding", async ({ page, context }) => {
    test.slow();
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 13.0827, longitude: 80.2707 });

    await openAsNewVendor(page);
    await dismissTourIfOpen(page);

    // Verify Onboarding Step 1 is displayed
    await expect(page.getByText(/Vendor onboarding · 1\/4/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Business profile" })).toBeVisible();

    // Fill Step 1
    const businessNameInput = page.getByLabel("Business name");
    await businessNameInput.fill("Ananya Home Kitchen");
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 2: Location
    await expect(page.getByText(/Vendor onboarding · 2\/4/i)).toBeVisible();
    await page.getByPlaceholder("Street, landmark, area, city and PIN").fill("No 42, Gandhi Road, Adyar, Chennai, 600020");
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByText(/Exact pin|GPS pin/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 3: Fulfilment controls
    await expect(page.getByText(/Vendor onboarding · 3\/4/i)).toBeVisible();
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 4: Food certification and Terms & Conditions
    await expect(page.getByText(/Vendor onboarding · 4\/4/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Food certification" })).toBeVisible();

    // Fill FSSAI & Expiry
    await page.getByLabel("Food certificate / FSSAI number").fill("FSSAI-123456789012");
    await page.getByLabel("Expiry date").fill("2028-12-31");

    // Upload mock certificate
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("input[type=file]").evaluate((el: HTMLInputElement) => el.click());
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "fssai-cert.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test certificate"),
    });

    // 1. Verify Terms & Conditions Section Heading & Description
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    await expect(page.getByText(/Review the ShePlates Vendor Terms & Conditions/i)).toBeVisible();

    // 2. Verify Checkbox is UNCHECKED by default
    const termsCheckbox = page.locator("#vendor-terms-checkbox");
    await expect(termsCheckbox).toBeVisible();
    await expect(termsCheckbox).not.toBeChecked();

    // 3. Verify Submit button is DISABLED while terms are unchecked
    const submitBtn = page.getByRole("button", { name: /Submit for verification/i });
    await expect(submitBtn).toBeDisabled();

    // 4. Click "View Terms & Conditions" to open the PDF Viewer Modal
    const viewTermsBtn = page.getByRole("button", { name: "View Terms & Conditions" });
    await expect(viewTermsBtn).toBeVisible();
    await viewTermsBtn.click();

    // Verify Terms Modal is open with Title, Version 1.0, and iframe pointing to PDF
    await expect(page.getByRole("heading", { name: "ShePlates Vendor Terms & Conditions" })).toBeVisible();
    await expect(page.getByText(/Version 1\.0 · Effective Date: 7 October 2026/i)).toBeVisible();
    const pdfIframe = page.locator("iframe[src*='sheplates-vendor-terms-v1.0.pdf']");
    await expect(pdfIframe).toBeVisible();

    // Verify external link to PDF exists
    const externalLink = page.getByRole("link", { name: /Open in new tab/i });
    await expect(externalLink).toHaveAttribute("href", "/docs/sheplates-vendor-terms-v1.0.pdf");

    // Click "Accept & Close" in modal
    const acceptCloseBtn = page.getByRole("button", { name: /Accept & Close/i });
    await acceptCloseBtn.click();

    // Modal should close and checkbox should now be CHECKED
    await expect(page.getByRole("heading", { name: "ShePlates Vendor Terms & Conditions" })).toHaveCount(0);
    await expect(termsCheckbox).toBeChecked();

    // 5. Submit button should now be ENABLED
    await expect(submitBtn).toBeEnabled();

    // Uncheck checkbox manually to verify it disables submit button again
    await termsCheckbox.uncheck();
    await expect(submitBtn).toBeDisabled();

    // Check it again
    await termsCheckbox.check();
    await expect(submitBtn).toBeEnabled();

    // 6. Submit the onboarding application
    await submitBtn.click();

    // Success notification
    await expect(page.getByText(/Vendor application sent to Operations/i)).toBeVisible({ timeout: 10_000 });
  });

  test("Operations Verification Queue displays Terms Accepted status and version", async ({ page }) => {
    test.slow();
    await openAsOps(page);
    await dismissTourIfOpen(page);

    // Open mobile sidebar if needed
    const toggleNav = page.getByRole("button", { name: "Toggle navigation" });
    if (await toggleNav.isVisible()) {
      await toggleNav.click();
    }

    // Navigate to "Vendor verification"
    const verifBtn = page.getByRole("button", { name: "Vendor verification" }).first();
    await expect(verifBtn).toBeVisible({ timeout: 15_000 });
    await verifBtn.click();

    // Verify queue displays
    await expect(page.getByRole("heading", { name: "Verification queue" })).toBeVisible();

    // Verify that "Terms accepted:" label is present on vendor cards
    await expect(page.getByText(/Terms accepted:/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

