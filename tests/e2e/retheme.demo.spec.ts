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
      expect(m.bg).toBe("rgb(250, 247, 242)");
    });
  }
}

test("brand roles: actions are terracotta, navigation and selection are plum, dark panels are plum", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "customer");
  const colour = (selector: string, prop: "backgroundColor" | "color") => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el as HTMLElement)[p as "color"], prop);
  expect(await colour(".k-actions .ibtn.o", "backgroundColor"), "cart button").toBe("rgb(198, 93, 58)");
  expect(await colour(".k-menurow button.on", "backgroundColor"), "active navigation").toBe("rgb(81, 45, 58)");
  expect(await colour(".k-head .k-agent", "backgroundColor"), "She Agent button").toBe("rgb(81, 45, 58)");
  expect(await colour(".promo", "backgroundColor"), "Food Drops banner").toBe("rgb(81, 45, 58)");
  expect(await colour(".promo .btn.gold", "backgroundColor"), "banner highlight is gold").toBe("rgb(217, 184, 121)");
});

test("keyboard focus is a visible solid plum ring on buttons and links", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "customer");
  const rings = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    rings.add(await page.evaluate(() => { const el = document.activeElement as HTMLElement | null; if (!el || el === document.body) return "none"; const cs = getComputedStyle(el); return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`; }));
  }
  rings.delete("none");
  expect(rings.size, "something took focus").toBeGreaterThan(0);
  for (const ring of rings) expect(ring, "focus ring").toMatch(/^solid 3px rgb\(81, 45, 58\)$/);
});

test("status colours stay distinct from the brand", async ({ page }) => {
  await open(page, "vendor");
  const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ["--color-emerald-600", "--color-amber-700", "--color-red-600", "--color-sky-700", "--success", "--warning", "--destructive"].map((k) => s.getPropertyValue(k).trim().toLowerCase()); });
  expect(css).toEqual(["#21683b", "#795900", "#b42332", "#285fba", "#26834a", "#795900", "#b42332"]);
});
