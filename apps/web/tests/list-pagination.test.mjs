import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateItems } from '../lib/list-pagination.ts';

test('long lists show ten items and preserve source ordering', () => {
  const rows = Array.from({ length: 23 }, (_, index) => index);
  const first = paginateItems(rows, 0), second = paginateItems(rows, 1), last = paginateItems(rows, 2);
  assert.deepEqual(first.items, rows.slice(0, 10));
  assert.deepEqual(second.items, rows.slice(10, 20));
  assert.deepEqual(last.items, [20, 21, 22]);
  assert.equal(last.start, 21); assert.equal(last.end, 23); assert.equal(last.hasNext, false);
  assert.equal(first.hasNext, true); assert.equal(rows.length, 23);
});
test('empty results and exact page boundaries have correct ranges', () => {
  const empty = paginateItems([], 99);
  assert.equal(empty.start, 0); assert.equal(empty.end, 0); assert.equal(empty.page, 0); assert.equal(empty.hasNext, false);
  assert.equal(paginateItems(Array(10), 0).hasNext, false);
});
test('shrinking/filtering a list clamps an unavailable page', () => {
  assert.equal(paginateItems([1, 2], 5).page, 0);
  assert.equal(paginateItems([1, 2], -1).page, 0);
  assert.equal(paginateItems([1, 2], Infinity).page, 0);
  assert.equal(paginateItems([1, 2], 0, 0.5).items.length, 1);
});
