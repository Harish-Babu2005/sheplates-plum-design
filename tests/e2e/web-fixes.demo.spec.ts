import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

// The page's service worker would answer requests before Playwright can replace them.
test.use({ serviceWorkers: "block" });

const VENDOR = { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] };

type State = ReturnType<typeof buildDemoState>;
async function open(page: Page, tweak?: (state: State) => void) {
  const state = buildDemoState(); tweak?.(state);
  await page.addInitScript(([s, u]) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); } localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, VENDOR] as const);
  await page.goto("/");
  await page.waitForSelector(".k-app", { timeout: 30_000 });
}
async function goTo(page: Page, label: RegExp) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: label }).click();
}

test.describe("Store & radius: the map sits with the location controls", () => {
  test("the map is on screen next to the address even when suggestions are very long", async ({ page }) => {
    const long = "Plot 14, Sri Lakshmi Narasimha Swamy Temple Road, Behind the Old Municipal Corporation Water Tank, Near Thirumalaiswamy Nagar Third Cross Street, Coimbatore North, Tamil Nadu 641002, India";
    await page.route("**/api/geocode**", (route) => route.fulfill({ json: { suggestions: [1, 2, 3].map((n) => ({ address: `${long} ${n}`, latitude: 11.04 + n / 1000, longitude: 76.97 })) } }));
    await open(page);
    await dismissTourIfOpen(page).catch(() => undefined);
    await goTo(page, /^Store & radius/);
    const card = page.getByTestId("store-location-card");
    await expect(card).toBeVisible();
    await expect(card.getByTestId("store-map")).toBeVisible();
    await card.getByRole("textbox").first().fill(long);
    await expect(page.getByRole("button", { name: /Plot 14.*India 1/ })).toBeVisible();
    const viewport = page.viewportSize()!;
    const map = await page.getByTestId("store-map").boundingBox();
    expect(map, "map has a box").toBeTruthy();
    expect(map!.x).toBeGreaterThanOrEqual(0);
    expect(map!.x + map!.width, "map is not pushed past the right edge").toBeLessThanOrEqual(viewport.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const save = await page.getByRole("button", { name: "Save store pin & radius" }).boundingBox();
    expect(map!.y).toBeLessThan(save!.y);
    await page.getByTestId("store-map").scrollIntoViewIfNeeded();
    await expect(page.locator(".leaflet-container, [data-map-engine]").first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Catalog: bulk upload and delete", () => {
  async function openCatalog(page: Page) { await open(page); await goTo(page, /^Catalog/); await expect(page.getByRole("heading", { name: "Items, packs & nutrition" })).toBeVisible(); }

  test("a CSV with a header row is read, shows what is missing, and publishes the complete rows", async ({ page }) => {
    await openCatalog(page);
    await page.getByRole("button", { name: "Upload product list" }).click();
    const csv = "Name,Category,Pack,Price,Stock,Food type\nPepper Rasam,Home food,1 portion,70,12,Veg\nPrawn Fry,Meat & fish,250 g,260,8,Non-veg\nHalf Done,Home food,1 portion,,,\n";
    await page.getByTestId("bulk-file").setInputFiles({ name: "list.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByTestId("bulk-summary")).toContainText("3 products found");
    await expect(page.getByTestId("bulk-summary")).toContainText("1 still need a price or stock");
    const rows = page.getByTestId("bulk-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(2)).toContainText("Add a price");
    await expect(page.getByLabel("Food type, row 2")).toHaveValue("non_veg");
    await expect(page.getByLabel("Product name, row 1")).toHaveValue("Pepper Rasam");
    await expect(page.getByRole("button", { name: /Approve & publish 2 items \(1 incomplete will wait\)/ })).toBeEnabled();
    await page.getByRole("button", { name: /Approve & publish 2 items/ }).click();
    await expect(page.getByText("2 item(s) published")).toBeVisible();
    await expect(page.getByText("Pepper Rasam").first()).toBeVisible();
    await expect(page.getByText("Prawn Fry").first()).toBeVisible();
    await expect(page.getByText("Half Done")).toHaveCount(0);
  });

  test("an Excel file works, and the same file can be chosen again", async ({ page }) => {
    await openCatalog(page);
    await page.getByRole("button", { name: "Upload product list" }).click();
    const sheet = XLSX.utils.aoa_to_sheet([["Product name", "Rate", "Qty", "Veg/Non-veg"], ["Ragi Malt", 120, 8, "Veg"], ["Egg Puff", 35, 20, "Egg"]]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Items");
    const buffer = Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    const file = { name: "items.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer };
    await page.getByTestId("bulk-file").setInputFiles(file);
    await expect(page.getByTestId("bulk-row")).toHaveCount(2);
    await expect(page.getByLabel("Price, row 1")).toHaveValue("120");
    await expect(page.getByLabel("Food type, row 2")).toHaveValue("egg");
    await page.getByRole("button", { name: "Remove row 1" }).click();
    await expect(page.getByTestId("bulk-row")).toHaveCount(1);
    await page.getByTestId("bulk-file").setInputFiles(file);
    await expect(page.getByTestId("bulk-row")).toHaveCount(2);
  });

  test("a file with nothing readable says so, and the template downloads", async ({ page }) => {
    await openCatalog(page);
    await page.getByRole("button", { name: "Upload product list" }).click();
    await page.getByTestId("bulk-file").setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("\n\n") });
    await expect(page.getByText(/No products were found in that file/)).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download template" }).click();
    expect((await download).suggestedFilename()).toBe("sheplates-product-list-template.csv");
  });

  test("a vendor can delete a product after confirming, and can keep it instead", async ({ page }) => {
    await openCatalog(page);
    await expect(page.getByText("Sambar Rice").first()).toBeVisible();
    await page.getByRole("button", { name: "Delete Sambar Rice" }).click();
    await expect(page.getByRole("heading", { name: "Delete this product?" })).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByText("Sambar Rice").first()).toBeVisible();
    await page.getByRole("button", { name: "Delete Sambar Rice" }).click();
    await page.getByRole("button", { name: "Delete product" }).click();
    await expect(page.getByText("Sambar Rice deleted")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Sambar Rice" })).toHaveCount(0);
    await page.reload();
    await page.waitForSelector(".k-app", { timeout: 30_000 });
    await goTo(page, /^Catalog/);
    await expect(page.getByRole("button", { name: "Delete Curd Rice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Sambar Rice" })).toHaveCount(0);
  });
});

test.describe("Food Drops: a vendor can create one", () => {
  test("creating a drop on an eligible plan adds it to the list", async ({ page }) => {
    await open(page);
    await goTo(page, /^Food Drops/);
    await page.getByRole("button", { name: /New drop/ }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Curd Rice" }).click();
    await page.getByRole("button", { name: /Schedule drop/ }).click();
    await expect(page.getByText(/Food Drop (is live|scheduled for 12:00 PM)/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Curd Rice — flash drop/ })).toBeVisible();
  });

  test("a store on a plan without Food Drops is told why", async ({ page }) => {
    await open(page, (state) => { state.vendors = state.vendors.map((v) => v.id === "v-meena" ? { ...v, plan: "Crave" } : v); });
    await goTo(page, /^Food Drops/);
    await expect(page.getByText("Food Drops are on the Thrive and Crown plans")).toBeVisible();
  });
});

test.describe("She Agent never leaves the button spinning", () => {
  test("Store intelligence shows a quick read of the numbers when the written analysis is unavailable", async ({ page }) => {
    await page.route("**/api/agent", (route) => route.fulfill({ json: { source: "assistant", warning: "The written analysis took too long, so this is a quick read of your numbers.", result: { decision: "BUSINESS_SNAPSHOT", confidence: 60, summary: "Quick read of your numbers: Out of stock: Mini Meals.", recommendedAction: "Update the pack stock for these items so customers can order them again.", insights: { wentWell: ["5 of 6 products are live and in stock."], needsAttention: ["Out of stock: Mini Meals."], recovery: ["Update the pack stock."] } } } }));
    await open(page);
    await goTo(page, /^AI insights/);
    await page.getByRole("button", { name: "Ask She Agent" }).click();
    await expect(page.getByText("Quick read of your numbers: Out of stock: Mini Meals.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask She Agent" })).toBeEnabled();
  });

  test("Store intelligence stops waiting after a minute and says so", async ({ page }) => {
    await page.clock.install();
    await page.route("**/api/agent", () => undefined);
    await open(page);
    await goTo(page, /^AI insights/);
    await page.getByRole("button", { name: "Ask She Agent" }).click();
    await expect(page.getByRole("button", { name: "Analysing…" })).toBeDisabled();
    await page.clock.fastForward(61_000);
    await expect(page.getByText("This is taking longer than expected. Please try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask She Agent" })).toBeEnabled();
  });
});

test.describe("Vendor Terms & Conditions can be read before accepting", () => {
  test("an existing vendor who has not accepted can open the document from Verification", async ({ page }) => {
    await open(page, (state) => { state.vendors = state.vendors.map((v) => v.id === "v-meena" ? { ...v, termsAccepted: false } : v); });
    await goTo(page, /^Verification/);
    const section = page.getByRole("region", { name: "Vendor Terms and Conditions" });
    await expect(section).toBeVisible();
    await section.getByRole("button", { name: "View Terms & Conditions" }).click();
    await expect(page.getByTestId("terms-viewer")).toBeVisible();
    await expect(page.locator("iframe[src*='sheplates-vendor-terms-v1.0.pdf']")).toBeVisible();
    const response = await page.request.get("/docs/sheplates-vendor-terms-v1.0.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("pdf");
  });
});
