import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const theme of ['light', 'dark']) {
  test(`${theme} form text and placeholders meet WCAG AA contrast`, () => {
    const block = css.split(`[data-theme="${theme}"] {`)[1].split('}')[0];
    const vars = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map(m => [m[1], m[2]]));
    for (const foreground of ['foreground', 'muted-foreground']) {
      for (const background of ['surface', 'background', 'surface-muted']) {
        const a = luminance(vars[foreground]), b = luminance(vars[background]);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio}`);
      }
    }
  });
}
