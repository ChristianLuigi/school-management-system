import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { accessibleBrandColors, contrastRatio } from '../lib/theme-colors.ts';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
for (const theme of ['light', 'dark']) {
  test(`${theme}: semantic text, status and solid-control pairs meet AA contrast`, () => {
    const block = css.split(`[data-theme="${theme}"] {`)[1].split('}')[0];
    const vars = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map(m => [m[1], m[2]]));
    for (const tone of ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info']) {
      assert.ok(contrastRatio(vars[tone], vars[`${tone}-foreground`]) >= 4.5, `${theme}: solid ${tone}`);
      if (vars[`${tone}-subtle`]) assert.ok(contrastRatio(vars[tone], vars[`${tone}-subtle`]) >= 4.5, `${theme}: ${tone} alert`);
    }
    for (const background of ['background', 'surface', 'surface-muted']) {
      assert.ok(contrastRatio(vars.foreground, vars[background]) >= 4.5);
      assert.ok(contrastRatio(vars['muted-foreground'], vars[background]) >= 4.5);
    }
    assert.ok(contrastRatio(vars.input, vars.surface) >= 3, `${theme}: input boundary`);
  });
  test(`${theme}: custom school colors retain readable text, links and hover states`, () => {
    const colors = ['#000000', '#ffffff', '#ffff00', '#ff0000', '#00ff00', '#0000ff', '#1d4ed8', '#0f766e', '#808080', 'invalid'];
    const surfaces = theme === 'dark' ? ['#0b1120', '#111a2d', '#162137', '#1a263c'] : ['#f6f8fb', '#ffffff', '#eef2f7'];
    for (const color of colors) {
      const tokens = accessibleBrandColors(color, color, theme === 'dark');
      assert.ok(contrastRatio(tokens['--primary'], tokens['--primary-foreground']) >= 4.5);
      assert.ok(contrastRatio(tokens['--primary-hover'], tokens['--primary-foreground']) >= 4.5);
      assert.ok(contrastRatio(tokens['--accent'], tokens['--accent-foreground']) >= 4.5);
      for (const surface of surfaces) assert.ok(contrastRatio(tokens['--primary'], surface) >= 4.5, `${color} on ${surface}`);
    }
  });
}

test('interactive UI does not reintroduce fixed theme palette classes or malformed client directives', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const excluded = /(?:print|thermal|receipt|payslip|decision-letter|school-logo)/i;
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(dir, entry.name)] : []);
  const violations = [];
  for (const file of [...walk(path.join(root, 'components')), ...walk(path.join(root, 'app'))]) {
    if (excluded.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    assert.ok(!/["']use\s{2,}client["']/.test(source), `Malformed directive: ${file}`);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        const value = node.getText(tree).replace(/print:[\w:/-]+/g, '');
        if (/\b(?:bg|text|border|ring|divide|outline)-(?:slate|gray|zinc|neutral|red|rose|orange|amber|yellow|green|emerald|teal|blue|indigo|violet|purple)-(?:50|[1-9]00|950)\b|\bbg-white\b|\btext-white\b/.test(value)) violations.push(path.relative(root, file));
      } else ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.deepEqual([...new Set(violations)], []);
});
