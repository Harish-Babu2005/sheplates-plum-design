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

test("the brand tokens are the launch palette, one value per role", async () => {
  const block = await root_block();
  const expected = {
    "--brand-primary": "#0C7478", "--brand-primary-hover": "#095A5D", "--brand-secondary": "#FFFFFF", "--brand-accent": "#3DBE74",
    "--brand-mint": "#D9F5E7", "--background": "#F6F8F8", "--card": "#FFFFFF", "--surface-soft": "#EEF2F2", "--border": "#DDE3E4",
    "--foreground": "#0F1B1D", "--text-secondary": "#55656A", "--text-muted": "#5F6F74", "--selected-soft": "#E4F2F2",
    "--success": "#26834A", "--warning": "#795900", "--destructive": "#B42332",
  };
  for (const [token, value] of Object.entries(expected)) assert.match(block, new RegExp(`${token}:\\s*${value};`, "i"), token);
  assert.match(block, /--action-primary:\s*var\(--brand-primary\)/);
  assert.match(block, /--selected:\s*var\(--brand-primary\)/);
  assert.match(block, /--focus-ring:\s*var\(--brand-primary\)/);
  assert.match(block, /--radius-card:\s*24px/);
  assert.match(block, /--radius-control:\s*999px/);
  assert.equal(await read("design/colors.css").then((c) => /--brand-primary:\s*#0C7478/.test(c)), true, "the reference copy matches");
});

test("legacy token families keep distinct meanings instead of all pointing at one colour", async () => {
  const block = await root_block();
  const value = (name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
  assert.equal(value("--sp7-orange"), "var(--brand-primary)", "the old orange token is the primary action colour");
  assert.equal(value("--sp7-green"), "var(--brand-primary)");
  assert.equal(value("--sp72-lime"), "var(--brand-accent)", "the old lime token is the fresh-green accent");
  const targets = new Set(["--sp-green", "--sp-coral", "--sp7-orange", "--sp72-lime", "--sp-cream", "--sp-paper"].map(value));
  assert.ok(targets.size >= 4, "legacy families map to at least four different roles");
});

test("primary actions and navigation are teal, and the accent is fresh green with dark text", async () => {
  const theme = await read("app/theme-2.css");
  assert.match(theme, /\[data-variant="default"\] \{\s*background: var\(--action-primary\)/);
  assert.match(theme, /\[data-variant="default"\]:hover \{\s*background: var\(--action-hover\)/);
  assert.match(theme, /\.sp-entry-primary-btn,[^{]*\{\s*background: var\(--action-primary\)/);
  const kit = await read("app/design-kit.css");
  assert.match(kit, /\.sh \.btn\{[^}]*background:var\(--act\)/);
  assert.match(kit, /\.sh \.nav \.it\.on\{background:var\(--o\)/);
  assert.match(kit, /\.sh \.btn\.accent\{background:var\(--brand-accent\);color:var\(--ink\)/);
  const shell = await read("app/shell-kit.css");
  assert.match(shell, /\.k-menurow button\.on \{ background: var\(--selected\)/);
  assert.match(await read("app/staff-kit.css"), /\.k-nv\.on \{ background: var\(--selected\)/);
});

test("source colours come from the palette: no retired plum, terracotta, gold or orange values remain", async () => {
  const old = /#(753b50|602d40|653046|faf6f4|f7edf0|292124|e8dfe1|e8cbd5|71676b|766b70|312629|5f8f2d|237a45|512d3a|40222e|c65d3a|a84b2c|faf7f2|f5ede7|292526|d9b879)\b/i;
  const files = [...await sourceFiles("components", [".tsx", ".ts"]), ...await sourceFiles("app", [".tsx", ".ts", ".css"]), ...await sourceFiles("lib", [".ts"])];
  const offenders = [];
  for (const file of files) if (old.test(await read(file))) offenders.push(file);
  assert.deepEqual(offenders, [], "files still using retired colours");
  assert.doesNotMatch(await read("app/theme-2.css"), /plum|terracotta|Delifood/i, "the header no longer describes a previous theme");
});

test("brand colours used in components are only the approved palette values", async () => {
  const allowed = new Set(["#0C7478", "#095A5D", "#3DBE74", "#D9F5E7", "#F6F8F8", "#FFFFFF", "#EEF2F2", "#E3E9E9", "#E4F2F2", "#C5E3E4", "#DDE3E4",
    "#0F1B1D", "#2F3C3F", "#55656A", "#5F6F74", "#B6C0C2", "#D3E8E9"]);
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
  for (const bad of ["#753b50", "#292124", "#f7edf0", "#512d3a", "#c65d3a", "#d9b879"]) assert.equal(stray.has(bad), false, bad);
});

test("status colours stay their own hues and are not remapped to the brand", async () => {
  const css = await read("app/theme-2.css");
  const tail = css.slice(css.indexOf("/* ---- stock Tailwind palettes"));
  for (const [token, value] of [["--color-emerald-600", "#21683b"], ["--color-amber-700", "#795900"], ["--color-red-600", "#b42332"], ["--color-sky-700", "#285fba"]])
    assert.match(tail, new RegExp(`${token}:\\s*${value}`, "i"), token);
  assert.match(tail, /--color-orange-500:\s*#3DBE74/i, "the stock orange family follows the fresh-green accent");
  assert.match(tail, /--color-violet-700:\s*#0C7478/i, "the stock violet family is the primary teal");
});

test("the focus ring is a solid token colour and the manifest and meta colour match the brand", async () => {
  assert.match(await read("app/theme-2.css"), /outline: 3px solid var\(--focus-ring\)/);
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.theme_color, "#0C7478");
  assert.equal(manifest.background_color, "#F6F8F8");
  assert.match(await read("app/layout.tsx"), /themeColor: "#0C7478"/);
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

test("phone layouts: tables turn into labelled cards, stat tiles pair up and dark panels are teal", async () => {
  const staff = await read("app/staff-kit.css");
  assert.match(staff, /@media \(max-width: 640px\) \{[\s\S]*\[data-slot="table-row"\] \{ display: grid;/);
  assert.match(staff, /content: attr\(data-label\)/);
  assert.match(staff, /\.grid:has\(> \.sp-metric-card\) \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(await read("app/theme-2.css"), /html \.sp-v7 \.surface-dark,[^}]*background: var\(--brand-primary\) !important/);
  const labels = await read("components/table-labels.tsx");
  assert.match(labels, /setAttribute\("data-label"/);
  assert.doesNotMatch(labels, /fetch\(|localStorage|supabase/i, "the helper is presentational only");
  assert.match(await read("app/layout.tsx"), /<TableLabels \/>/);
});
