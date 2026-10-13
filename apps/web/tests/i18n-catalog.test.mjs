import test from 'node:test';
import assert from 'node:assert/strict';
import { messages } from '../lib/i18n/messages.ts';
import { createInstance } from 'i18next';

test('French and English catalogs expose identical translation keys', () => {
  function keys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [`${prefix}${key}`] : keys(item, `${prefix}${key}.`)).sort();
  }
  assert.deepEqual(keys(messages.fr), keys(messages.en));
});
test('i18next switches catalogs and preserves existing interpolation', async () => {
  const instance = createInstance();
  await instance.init({ lng: 'en', resources: { en: { translation: { greeting: 'Hello {name}' } }, fr: { translation: { greeting: 'Bonjour {name}' } } }, interpolation: { prefix: '{', suffix: '}', escapeValue: false } });
  assert.equal(instance.t('greeting', { name: 'Anne' }), 'Hello Anne');
  await instance.changeLanguage('fr');
  assert.equal(instance.t('greeting', { name: 'Anne' }), 'Bonjour Anne');
});
