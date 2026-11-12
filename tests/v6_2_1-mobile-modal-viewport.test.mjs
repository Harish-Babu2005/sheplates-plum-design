import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const dialog = fs.readFileSync(new URL('../components/ui/dialog.tsx', import.meta.url), 'utf8');
const sheet = fs.readFileSync(new URL('../components/ui/sheet.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('mobile dialogs are viewport anchored and no longer use translated centering', () => {
  assert.match(css, /\[data-slot="dialog-content"\][\s\S]*?inset: auto 0 0 0 !important/);
  assert.match(css, /width: auto !important/);
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /transform: none !important/);
});

test('modal layers stay above the mobile bottom navigation', () => {
  // Dialogs and sheets sit above the Leaflet map layers (z-index 1000): overlay 1100, content 1101. On phones the stylesheet pins them to 90 / 91,
  // which is still above the bottom navigation (58).
  assert.match(dialog, /z-\[1100\]/);
  assert.match(dialog, /z-\[1101\]/);
  assert.match(sheet, /z-\[1100\]/);
  assert.match(sheet, /z-\[1101\]/);
  assert.match(css, /\[data-slot="dialog-overlay"\][\s\S]*?z-index: 90 !important/);
  assert.match(css, /\[data-slot="dialog-content"\][\s\S]*?z-index: 91 !important/);
  assert.match(css, /\.sp-mobile-bottom-nav[\s\S]*?z-index: 58/);
});

test('auth dialog remains keyboard friendly without percentage width math', () => {
  assert.match(css, /\[data-slot="dialog-content"\]\.sp-auth-dialog[\s\S]*?left: 8px !important[\s\S]*?right: 8px !important[\s\S]*?width: auto !important/);
});

test('release inherits the v7 visual version', () => {
  assert.equal(pkg.version, '7.2.0');
});
