import { expect, test, type Page } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";
import { dismissTourIfOpen } from "./helpers";

const SESSIONS = {
  customer: { email: "customer@sheplates.demo", name: "Raj", role: "customer", toursCompleted: ["customer_v1"] },
  vendor: { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] },
  operations: { email: "operations@sheplates.demo", name: "Ops", role: "operations", toursCompleted: ["operations_v1"] },
  admin: { email: "admin@sheplates.demo", name: "Admin", role: "admin", toursCompleted: ["admin_v1"] },
} as const;

async function open(page: Page, who: keyof typeof SESSIONS | null) {
  await page.addInitScript(([s, u]) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
    if (u) localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
  }, [buildDemoState(), who ? SESSIONS[who] : null] as const);
  await page.goto("/");
  await page.waitForSelector(who ? (who === "customer" ? ".k-head, .k-pill" : ".k-app") : ".e-page", { timeout: 30_000 });
  if (who === "customer") await dismissTourIfOpen(page);
}

const VIEWPORTS = [{ name: "phone", width: 390, height: 844 }, { name: "tablet", width: 820, height: 1180 }, { name: "desktop", width: 1440, height: 900 }];

for (const who of ["customer", "vendor", "operations", "admin"] as const) {
  for (const vp of VIEWPORTS) {
    test(`${who} on ${vp.name}: no horizontal overflow and ivory page ground`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page, who);
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, bg: getComputedStyle(document.body).backgroundColor }));
      expect(m.scroll, "page scrolls sideways").toBeLessThanOrEqual(m.inner + 1);
      expect(m.bg).toBe("rgb(255, 255, 255)");
    });
  }
}

test("brand roles: actions, navigation and dark panels are teal, the accent is fresh green", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "customer");
  const colour = (selector: string, prop: "backgroundColor" | "color") => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el as HTMLElement)[p as "color"], prop);
  expect(await colour(".k-actions .ibtn.o", "backgroundColor"), "cart button").toBe("rgb(21, 95, 101)");
  expect(await colour(".k-menurow button.on", "backgroundColor"), "active navigation").toBe("rgb(21, 95, 101)");
  expect(await colour(".k-head .k-agent", "backgroundColor"), "She Agent button").toBe("rgb(21, 95, 101)");
  expect(await colour(".promo", "backgroundColor"), "Food Drops banner").toBe("rgb(21, 95, 101)");
  expect(await colour(".promo .btn.accent", "backgroundColor"), "banner highlight is fresh green").toBe("rgb(61, 190, 116)");
});

test("keyboard focus is a visible solid teal ring on buttons and links", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "customer");
  const rings = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    rings.add(await page.evaluate(() => { const el = document.activeElement as HTMLElement | null; if (!el || el === document.body) return "none"; const cs = getComputedStyle(el); return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`; }));
  }
  rings.delete("none");
  expect(rings.size, "something took focus").toBeGreaterThan(0);
  for (const ring of rings) expect(ring, "focus ring").toMatch(/^solid 3px rgb\(21, 95, 101\)$/);
});

test("status colours stay distinct from the brand", async ({ page }) => {
  await open(page, "vendor");
  const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ["--color-emerald-600", "--color-amber-700", "--color-red-600", "--color-sky-700", "--success", "--warning", "--destructive"].map((k) => s.getPropertyValue(k).trim().toLowerCase()); });
  expect(css).toEqual(["#21683b", "#795900", "#b42332", "#285fba", "#26834a", "#795900", "#b42332"]);
});

for (const width of [320, 360, 390]) {
  test(`landing and sign-in fit a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page, null);
    await page.waitForTimeout(1200);
    const head = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, rights: Array.from(document.querySelector(".e-head")!.children).map((c) => Math.round(c.getBoundingClientRect().right)) }));
    expect(head.sw, "page scrolls sideways").toBeLessThanOrEqual(head.iw);
    for (const right of head.rights) expect(right, "header item runs off the screen").toBeLessThanOrEqual(head.iw);
    await page.locator(".e-hero").getByRole("button", { name: "Sign In", exact: true }).first().click();
    await page.waitForSelector("[data-slot='dialog-content']");
    await page.waitForTimeout(600);
    const dialog = await page.evaluate(() => { const d = document.querySelector("[data-slot='dialog-content']")!; const r = d.getBoundingClientRect(); const t = d.querySelector("[data-slot='dialog-title']")!; return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight, title: getComputedStyle(t).color }; });
    expect(dialog.l).toBeGreaterThanOrEqual(0);
    expect(dialog.r).toBeLessThanOrEqual(dialog.vw);
    expect(dialog.t).toBeGreaterThanOrEqual(0);
    expect(dialog.b).toBeLessThanOrEqual(dialog.vh + 1);
    expect(dialog.title, "heading is readable on the teal panel").toBe("rgb(255, 255, 255)");
  });
}

test("staff tables become readable cards on a phone and nothing is clipped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "admin");
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if ((await toggle.isVisible().catch(() => false)) && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
  await page.locator("aside.k-side nav").getByRole("button", { name: /^Vendors\s*\d*$/ }).click();
  await page.waitForTimeout(800);
  const row = page.locator("[data-slot='table-body'] [data-slot='table-row']").first();
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).display), "rows are cards").toBe("grid");
  const cells = await row.locator("> *").evaluateAll((els) => els.map((el) => ({ right: Math.round(el.getBoundingClientRect().right), label: el.getAttribute("data-label") })));
  for (const cell of cells) expect(cell.right, "cell runs off the screen").toBeLessThanOrEqual(390);
  expect(cells.slice(1).every((c) => !!c.label), "every value has its column heading").toBe(true);
});
