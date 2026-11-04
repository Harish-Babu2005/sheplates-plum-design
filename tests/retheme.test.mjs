import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");

async function sourceFiles(dir, exts) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await sourceFiles(rel, exts));
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(rel);
  }
  return out;
}

const root_block = async () => {
  const css = await read("app/theme-2.css");
  return css.slice(css.indexOf(":root,"), css.indexOf("@theme inline"));
};

test("the brand tokens are the approved palette, one value per role", async () => {
  const block = await root_block();
  const expected = {
    "--brand-primary": "#512D3A", "--brand-primary-hover": "#40222E", "--brand-secondary": "#C65D3A",
    "--brand-secondary-hover": "#A84B2C", "--brand-accent": "#D9B879", "--background": "#FAF7F2", "--card": "#FFFFFF",
    "--surface-soft": "#F5EDE7", "--border": "#E9DDD5", "--foreground": "#292526", "--text-secondary": "#665B5D",
    "--text-muted": "#756B6C", "--selected-soft": "#F2E8EC", "--success": "#26834A", "--warning": "#795900", "--destructive": "#B42332",
  };
  for (const [token, value] of Object.entries(expected)) assert.match(block, new RegExp(`${token}:\\s*${value};`, "i"), token);
  assert.match(block, /--action-primary:\s*var\(--brand-secondary\)/);
  assert.match(block, /--selected:\s*var\(--brand-primary\)/);
  assert.match(block, /--focus-ring:\s*var\(--brand-primary\)/);
  assert.match(block, /--radius-card:\s*24px/);
  assert.match(block, /--radius-control:\s*999px/);
  assert.equal(await read("design/colors.css").then((c) => /--brand-secondary:\s*#C65D3A/.test(c)), true, "the reference copy matches");
});

test("legacy token families keep distinct meanings instead of all pointing at plum", async () => {
  const block = await root_block();
  const value = (name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
  assert.equal(value("--sp7-orange"), "var(--brand-secondary)", "the old orange token is the terracotta action");
  assert.equal(value("--sp7-green"), "var(--brand-primary)");
  assert.equal(value("--sp72-lime"), "var(--brand-accent)", "the old lime token is the gold accent");
  const targets = new Set(["--sp-green", "--sp-coral", "--sp7-orange", "--sp72-lime", "--sp-cream", "--sp-paper"].map(value));
  assert.ok(targets.size >= 4, "legacy families map to at least four different roles");
});

test("primary actions are terracotta and selected or navigation states are plum", async () => {
  const theme = await read("app/theme-2.css");
  assert.match(theme, /\[data-variant="default"\] \{\s*background: var\(--action-primary\)/);
  assert.match(theme, /\[data-variant="default"\]:hover \{\s*background: var\(--action-hover\)/);
  assert.match(theme, /\.sp-entry-primary-btn,[^{]*\{\s*background: var\(--action-primary\)/);
  const kit = await read("app/design-kit.css");
  assert.match(kit, /\.sh \.btn\{[^}]*background:var\(--act\)/);
  assert.match(kit, /\.sh \.nav \.it\.on\{background:var\(--o\)/);
  assert.match(kit, /\.sh \.btn\.gold\{background:var\(--gold\)/);
  const shell = await read("app/shell-kit.css");
  assert.match(shell, /\.k-menurow button\.on \{ background: var\(--selected\)/);
  assert.match(await read("app/staff-kit.css"), /\.k-nv\.on \{ background: var\(--selected\)/);
});

test("source colours come from the palette: no old plum, orange or green values remain", async () => {
  const old = /#(753b50|602d40|653046|faf6f4|f7edf0|292124|e8dfe1|e8cbd5|71676b|766b70|312629|5f8f2d|237a45)\b/i;
  const files = [...await sourceFiles("components", [".tsx", ".ts"]), ...await sourceFiles("app", [".tsx", ".ts", ".css"]), ...await sourceFiles("lib", [".ts"])];
  const offenders = [];
  for (const file of files) if (old.test(await read(file))) offenders.push(file);
  assert.deepEqual(offenders, [], "files still using retired colours");
  assert.doesNotMatch(await read("app/theme-2.css"), /orange #753b50|Delifood/i, "the header no longer describes the previous orange theme");
});

test("brand colours used in components are only the approved palette values", async () => {
  const allowed = new Set(["#512D3A", "#40222E", "#C65D3A", "#A84B2C", "#D9B879", "#FAF7F2", "#FFFFFF", "#F5EDE7", "#EDE2DA", "#F2E8EC", "#E6D2DA", "#E9DDD5",
    "#292526", "#4A4143", "#665B5D", "#6F6567", "#B9AEA9", "#EADBE1", "#211C1D", "#F8E7DF"]);
  const status = /^(#(?:b42332|795900|fff4cf|eaf5ec|21683b|edf3fd|285fba|fdecef|f0c3c9|26834a|e3a008|f5a524|c98a00|a67c00|d63a4a))$/i;
  const files = [...await sourceFiles("components", [".tsx"])];
  const stray = new Map();
  for (const file of files) {
    for (const hex of (await read(file)).match(/#[0-9a-fA-F]{6}\b/g) || []) {
      if (allowed.has(hex.toUpperCase()) || status.test(hex)) continue;
      stray.set(hex.toLowerCase(), (stray.get(hex.toLowerCase()) || 0) + 1);
    }
  }
  // Remaining hex values are category glyph colours, pastel category tints and seed/demo data, kept on purpose.
  assert.ok(stray.size <= 40, `unexpected number of unclassified colours: ${[...stray.keys()].join(", ")}`);
  for (const bad of ["#753b50", "#292124", "#f7edf0"]) assert.equal(stray.has(bad), false, bad);
});

test("status colours stay their own hues and are not remapped to the brand", async () => {
  const css = await read("app/theme-2.css");
  const tail = css.slice(css.indexOf("/* ---- stock Tailwind palettes"));
  for (const [token, value] of [["--color-emerald-600", "#21683b"], ["--color-amber-700", "#795900"], ["--color-red-600", "#b42332"], ["--color-sky-700", "#285fba"]])
    assert.match(tail, new RegExp(`${token}:\\s*${value}`, "i"), token);
  assert.match(tail, /--color-orange-500:\s*#C65D3A/i, "the stock orange family is terracotta");
  assert.match(tail, /--color-violet-700:\s*#512D3A/i, "the stock violet family is plum");
});

test("the focus ring is a solid token colour and the manifest and meta colour match the brand", async () => {
  assert.match(await read("app/theme-2.css"), /outline: 3px solid var\(--focus-ring\)/);
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.theme_color, "#512D3A");
  assert.equal(manifest.background_color, "#FAF7F2");
  assert.match(await read("app/layout.tsx"), /themeColor: "#512D3A"/);
});

test("phone dialogs stay on screen even after the production CSS minifier merges transform and translate", async () => {
  const css = await read("app/globals.css");
  // The minifier folds `transform: none` + `translate: none` into one transform and drops `translate`, so the Tailwind
  // centring variables must be zeroed as well. Both phone rules (bottom sheets and the sign-in dialog) need it.
  const blocks = css.match(/translate: none !important;[^}]*}/g) || [];
  assert.equal(blocks.length, 2, "the two phone dialog rules");
  for (const block of blocks) {
    assert.match(block, /--tw-translate-x: 0px !important/);
    assert.match(block, /--tw-translate-y: 0px !important/);
  }
});

test("the sign-in panel text and the landing header are built for phone widths", async () => {
  const shell = await read("app/shell-kit.css");
  assert.match(shell, /\.sp-auth-dialog \.sp-auth-hero \[data-slot="dialog-title"\][^}]*color: var\(--on-brand\) !important/);
  assert.match(shell, /@media \(max-width: 520px\) \{\s*\.e-head \{ gap: 8px; padding: 10px 12px; \}\s*\.e-logo \{ font-size: 0;/);
  assert.match(shell, /@media \(max-width: 380px\)/);
});
