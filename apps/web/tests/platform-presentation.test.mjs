import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlatformSchools, platformLabel } from '../lib/platform-presentation.ts';

const schools = [
  { name: 'École du Nord', code: 'N-01', status: 'ACTIVE', management_mode: 'SELF_MANAGED' },
  { name: 'Collège Sud', code: 'S-02', status: 'SUSPENDED', management_mode: 'HYBRID_MANAGED' },
];
test('school search is case/accent insensitive and matches codes', () => {
  assert.equal(filterPlatformSchools(schools, 'ECOLE', '', '').length, 1);
  assert.equal(filterPlatformSchools(schools, 's-02', '', '')[0].name, 'Collège Sud');
});
test('school filters combine and do not mutate the source', () => {
  assert.equal(filterPlatformSchools(schools, '', 'ACTIVE', 'HYBRID_MANAGED').length, 0);
  assert.equal(filterPlatformSchools(schools, '', 'ACTIVE', 'SELF_MANAGED').length, 1);
  assert.equal(schools.length, 2);
});
test('status/mode labels are localized without changing unknown codes', () => {
  assert.equal(platformLabel('ACTIVE_SETUP', 'fr'), 'En configuration');
  assert.equal(platformLabel('SUPERADMIN_MANAGED', 'en'), 'ALMAC-managed');
  assert.equal(platformLabel('FUTURE_CODE', 'en'), 'FUTURE_CODE');
});
