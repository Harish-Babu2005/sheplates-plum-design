import { test, expect, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

const NEW_VENDOR = {
  email: "compliance_chef@sheplates.demo",
  name: "Chef Deepa",
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

test.describe("Vendor Onboarding - 6 Compliance Documents (PDF only)", () => {
  test("Vendor can fill all 6 compliance forms with PDF documents alongside FSSAI and submit", async ({ page, context }) => {
    test.slow();
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 13.0827, longitude: 80.2707 });

    await openAsNewVendor(page);
    await dismissTourIfOpen(page);

    // Step 1: Business Profile
    await expect(page.getByText(/Vendor onboarding · 1\/4/i)).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Business name").fill("Deepa Artisanal Bakes");
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 2: Location
    await expect(page.getByText(/Vendor onboarding · 2\/4/i)).toBeVisible();
    await page.getByPlaceholder("Street, landmark, area, city and PIN").fill("No 14, 2nd Main Road, Besant Nagar, Chennai, 600090");
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByText(/Exact pin|GPS pin/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 3: Fulfilment
    await expect(page.getByText(/Vendor onboarding · 3\/4/i)).toBeVisible();
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 4: Documentation & Compliance
    await expect(page.getByText(/Vendor onboarding · 4\/4/i)).toBeVisible();
    await expect(page.getByText(/Strict Document Format Requirement: PDF Only/i)).toBeVisible();

    // 1. Mandatory Food Safety Certificate (FSSAI)
    await page.locator("#fssai-number-input").fill("FSSAI-11223344556677");
    await page.getByLabel("Expiry date").fill("2029-06-30");

    // Upload FSSAI PDF
    const fssaiChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#fssai-file-input").evaluate((el: HTMLInputElement) => el.click());
    const fssaiChooser = await fssaiChooserPromise;
    await fssaiChooser.setFiles({
      name: "deepa-fssai-license.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 FSSAI License Document"),
    });
    await expect(page.getByText("deepa-fssai-license.pdf")).toBeVisible();

    // 2. 1) PAN
    await page.locator("#pan-number-input").fill("ABCDE1234F");
    const panChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#pan-file-input").evaluate((el: HTMLInputElement) => el.click());
    const panChooser = await panChooserPromise;
    await panChooser.setFiles({
      name: "vendor-pan-card.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 PAN Card"),
    });
    await expect(page.getByText("vendor-pan-card.pdf")).toBeVisible();

    // 3. 2) Government Identity Proof
    await page.getByRole("button", { name: "Govt ID", exact: true }).click(); // one document form is shown at a time
    await page.locator("#govid-number-input").fill("9876 5432 1098");
    const govIdChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#govid-file-input").evaluate((el: HTMLInputElement) => el.click());
    const govIdChooser = await govIdChooserPromise;
    await govIdChooser.setFiles({
      name: "aadhaar-card-proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Aadhaar Card Proof"),
    });
    await expect(page.getByText("aadhaar-card-proof.pdf")).toBeVisible();

    // 4. 3) Address Proof
    await page.getByRole("button", { name: "Address Proof", exact: true }).click(); // one document form is shown at a time
    await page.locator("#addressproof-ref-input").fill("EB-BILL-442299");
    const addressChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#addressproof-file-input").evaluate((el: HTMLInputElement) => el.click());
    const addressChooser = await addressChooserPromise;
    await addressChooser.setFiles({
      name: "electricity-bill.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Electricity Bill"),
    });
    await expect(page.getByText("electricity-bill.pdf")).toBeVisible();

    // 5. 4) Bank Details
    await page.getByRole("button", { name: "Bank Details", exact: true }).click(); // one document form is shown at a time
    await page.locator("#bank-account-input").fill("50100234567890");
    await page.locator("#bank-ifsc-input").fill("HDFC0001234");
    const bankChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#bank-file-input").evaluate((el: HTMLInputElement) => el.click());
    const bankChooser = await bankChooserPromise;
    await bankChooser.setFiles({
      name: "cancelled-cheque.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Cancelled Cheque"),
    });
    await expect(page.getByText("cancelled-cheque.pdf")).toBeVisible();

    // 6. 5) Business Details
    await page.getByRole("button", { name: "Business Reg", exact: true }).click(); // one document form is shown at a time
    await page.locator("#business-reg-input").fill("33AAAAA0000A1Z5");
    const businessChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#business-file-input").evaluate((el: HTMLInputElement) => el.click());
    const businessChooser = await businessChooserPromise;
    await businessChooser.setFiles({
      name: "gst-registration.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 GST Certificate"),
    });
    await expect(page.getByText("gst-registration.pdf")).toBeVisible();

    // 7. 6) Product Information
    await page.getByRole("button", { name: "Product Info", exact: true }).click(); // one document form is shown at a time
    await page.locator("#productinfo-title-input").fill("Artisan Sourdough & Pastry Catalogue");
    const productChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#productinfo-file-input").evaluate((el: HTMLInputElement) => el.click());
    const productChooser = await productChooserPromise;
    await productChooser.setFiles({
      name: "menu-specifications.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Menu and Price List"),
    });
    await expect(page.getByText("menu-specifications.pdf")).toBeVisible();

    // Accept Terms & Conditions
    await page.locator("#vendor-terms-checkbox").check();

    // Submit for Verification
    const submitBtn = page.getByRole("button", { name: /Submit for verification/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify Success Toast / Redirect
    await expect(page.getByText(/Vendor application & compliance documents sent to Operations|Vendor application sent/i)).toBeVisible({ timeout: 10_000 });
  });

  test("Operations can review submitted compliance documents in Verification Queue", async ({ page }) => {
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

    // Verify Verification Queue heading
    await expect(page.getByRole("heading", { name: /Verification queue/i })).toBeVisible({ timeout: 10_000 });

    // Verify compliance documents section is displayed
    await expect(page.getByText(/Submitted Compliance Documents \(PDF\)/i).first()).toBeVisible();

    // Verify Inspect button is present
    const inspectBtn = page.getByRole("button", { name: /Inspect/i }).first();
    await expect(inspectBtn).toBeVisible();
    await inspectBtn.click();

    // Verify inspection modal opens
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Uploaded files are kept on the live site only/i)).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Food Safety Certificate (FSSAI)").first()).toBeVisible();
  });
});
