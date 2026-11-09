import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("the product is spelled Sheplates everywhere a person can read it", () => {
  for (const file of ["components/sheplates-entry.tsx", "components/sheplates-v3.tsx", "components/customer-v2/shell.tsx", "components/staff/shell.tsx", "app/layout.tsx", "public/manifest.webmanifest", "mobile/capacitor.config.ts"]) {
    assert.doesNotMatch(read(file), /ShePlates|She Plates/, file);
  }
  assert.match(read("app/layout.tsx"), /default: "Sheplates"/);
  assert.match(read("public/manifest.webmanifest"), /"name": "Sheplates"/);
});

test("the logo is the coral wordmark, one transparent image painted in the brand colour, in every shell", () => {
  assert.ok(existsSync(new URL("../public/brand/sheplates-wordmark-mask.png", import.meta.url)));
  assert.ok(statSync(new URL("../public/brand/sheplates-wordmark-mask.png", import.meta.url)).size > 20_000);
  const brand = read("components/brand.tsx");
  assert.match(brand, /coral: "#F15B5A"/);
  assert.match(brand, /ivory: "#FFF4E6"/);
  assert.match(brand, /gold: "#F4B942"/);
  assert.match(brand, /green: "#8AC43F"/);
  assert.match(brand, /lavender: "#A78BFA"/);
  for (const file of ["components/sheplates-entry.tsx", "components/sheplates-v3.tsx", "components/customer-v2/shell.tsx", "components/staff/shell.tsx", "app/reset-password/page.tsx"]) {
    assert.match(read(file), /<Wordmark /, file);
    assert.doesNotMatch(read(file), /src="\/sheplates-logo\.png"/, `${file} no longer shows the old badge`);
  }
});

test("the opening animation: five brand colours, ends on coral, ends by itself, can be skipped, respects reduced motion", () => {
  const css = read("app/globals.css");
  const frames = css.slice(css.indexOf("@keyframes sp-splash-colours"), css.indexOf("@keyframes sp-splash-pop"));
  const order = ["#FFF4E6", "#F4B942", "#F15B5A", "#8AC43F", "#A78BFA", "#F15B5A"];
  let at = 0;
  for (const colour of order) { at = frames.indexOf(colour, at); assert.ok(at >= 0, `${colour} in order`); at += colour.length; }
  assert.match(css, /animation: sp-splash-out \.45s ease 2\.1s both/, "the screen removes itself without any script");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const brand = read("components/brand.tsx");
  assert.match(brand, /onClick=/, "a tap skips it");
  assert.match(brand, /NEXT_PUBLIC_BRAND_SPLASH === "off"/);
  assert.match(read("app/layout.tsx"), /<BrandSplash \/>/);
});

test("the homepage uses the approved wording", () => {
  const entry = read("components/sheplates-entry.tsx");
  for (const text of ["Explore Marketplace", "How It Works", "Vendors &amp; Team", "Sign In", "Get Started", "Verified local food businesses near you", "Your neighbourhood marketplace for everything food.",
    "Discover home chefs, bakers, grocery stores, meat shops, fresh produce and more.", "Try She Agent", "Everything Local. All in One Place.", "Home Chefs · Grocers · Fresh Produce · Meat &amp; Fish · Local Dairies",
    "How Sheplates Works", "Discover businesses near you", "Explore products and order", "Choose how you receive your order", "Delivery or Pickup. Your Choice."]) {
    assert.ok(entry.includes(text), text);
  }
  assert.doesNotMatch(entry, /discovrr/);
});
