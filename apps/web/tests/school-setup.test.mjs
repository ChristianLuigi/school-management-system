import test from 'node:test';
import assert from 'node:assert/strict';
import { canBootstrapSchool, buildSetupPeriods } from '../lib/school-setup.ts';

test('initial setup requires a known eligible school with no academic year', () => {
  assert.equal(canBootstrapSchool(null), false);
  for (const status of ['ACTIVE', 'SUSPENDED', 'ARCHIVED']) assert.equal(canBootstrapSchool({ school: { status }, counts: { academicYears: 0 } }), false);
  assert.equal(canBootstrapSchool({ school: { status: 'DRAFT' }, counts: { academicYears: 1 } }), false);
  assert.equal(canBootstrapSchool({ school: { status: 'DRAFT' }, counts: { academicYears: 0 } }), true);
});
test('periods cover the selected year rather than a hardcoded year', () => {
  const periods = buildSetupPeriods('2027-09-01', '2028-06-30');
  assert.equal(periods[0].startDate, '2027-09-01');
  assert.equal(periods[2].endDate, '2028-06-30');
  for (let i = 1; i < 3; i++) assert.equal(Date.parse(periods[i].startDate) - Date.parse(periods[i - 1].endDate), 86400000);
});
test('invalid and too short ranges are rejected', () => {
  assert.throws(() => buildSetupPeriods('', ''));
  assert.throws(() => buildSetupPeriods('2027-09-03', '2027-09-01'));
  assert.throws(() => buildSetupPeriods('2027-09-01', '2027-09-02'));
});
