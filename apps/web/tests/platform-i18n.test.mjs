import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createInstance } from 'i18next';
import { platformFr, platformEn, platformErrorKey, platformAuditCopy } from '../lib/i18n/platform-copy.ts';

test('platform catalogs have parity, no blank translations and support punctuation/interpolation', async () => {
  assert.deepEqual(Object.keys(platformFr).sort(), Object.keys(platformEn).sort());
  assert.ok(Object.values(platformFr).every(value => value.trim()));
  const i18n = createInstance();
  await i18n.init({ lng: 'fr', defaultNS: 'platform', resources: { fr: { platform: platformFr }, en: { platform: platformEn } }, interpolation: { prefix: '{', suffix: '}', escapeValue: false } });
  assert.equal(i18n.t('Failed to load activity.', { keySeparator: false }), 'Impossible de charger l’activité.');
  assert.equal(i18n.t('Staff account created for {email}', { keySeparator: false, email: 'test@example.com' }), 'Compte créé pour test@example.com');
  await i18n.changeLanguage('en');
  assert.equal(i18n.t('First Name', { keySeparator: false }), 'First Name');
  assert.equal(i18n.t('fr', { keySeparator: false }), 'French');
});

test('unknown backend errors never leak untranslated internal details', () => {
  assert.equal(platformErrorKey('SELECT password_hash FROM users'), 'Unable to complete this action. Please try again.');
  assert.equal(platformErrorKey(['internal error']), 'Unable to complete this action. Please try again.');
});

test('audit summaries preserve names and addresses while localizing the message', () => {
  assert.deepEqual(platformAuditCopy('School École du Nord (N-01) was created.', 'SCHOOL_CREATED'), { key: 'School {name} was created.', params: { name: 'École du Nord (N-01)' } });
  assert.deepEqual(platformAuditCopy('Staff account jean@example.com was created as TEACHER.', 'STAFF_CREATED').params, { email: 'jean@example.com', role: 'TEACHER' });
  assert.equal(platformAuditCopy('Unrecognized English message', 'FUTURE_EVENT').key, 'Recorded action');
});

test('Super Admin pages and components contain no uncatalogued static UI copy', () => {
  const root = new URL('../', import.meta.url);
  const componentDir = path.join(fileURLToPath(root), 'components');
  const platformDir = path.join(componentDir, '../app/(dashboard)/(platform)/platform');
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(dir, entry.name)] : []);
  const files = [...readdirSync(componentDir).filter(name => /^platform-.*\.tsx$/.test(name)).map(name => path.join(componentDir, name)), ...walk(platformDir)];
  const allowed = new Set(['Marie', 'Pierre', 'ALMAC', 'Super Admin', 'L:', 'Y:', 'P:', 'G:', 'S:']);
  const attributes = new Set(['title', 'subtitle', 'description', 'label', 'placeholder', 'aria-label', 'name']);
  const violations = [];
  for (const file of files) {
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const check = (node, text) => {
      const value = text.replace(/\s+/g, ' ').trim();
      if (/[A-Za-zÀ-ÿ]{2}/.test(value) && !allowed.has(value) && !/^\S+@\S+\.\S+$/.test(value)) violations.push(`${path.basename(file)}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}: ${value}`);
    };
    function visibleExpression(node) {
      if (ts.isStringLiteral(node)) check(node, node.text);
      if (ts.isConditionalExpression(node) && !/\bfr\b|\blocale\b/.test(node.condition.getText(tree))) { visibleExpression(node.whenTrue); visibleExpression(node.whenFalse); }
    }
    function visit(node) {
      if (ts.isJsxText(node)) check(node, node.text);
      if (ts.isJsxAttribute(node) && !attributes.has(node.name.text)) return;
      if (ts.isJsxAttribute(node) && attributes.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) check(node, node.initializer.text);
      if (ts.isJsxExpression(node) && node.expression) visibleExpression(node.expression);
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'pt' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) assert.ok(node.arguments[0].text in platformFr, `Missing catalog entry: ${node.arguments[0].text}`);
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.deepEqual(violations, []);
});
