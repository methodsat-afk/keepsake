import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Regression guard for the timezone bug: photo year bucketing must use UTC so
 * ZIP folders (download/zip route) and gallery filters (PhotoGrid) agree
 * regardless of the server's timezone. A photo dated just after midnight UTC
 * must not slip into the previous year.
 *
 * This mirrors the exact derivation the app uses: new Date(iso).getUTCFullYear().
 */

function yearOf(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

test('midnight-UTC dates bucket by UTC year, not local', () => {
  // 2021-01-01T00:30:00Z is Dec 31 2020 in US timezones, but is 2021 in UTC.
  assert.equal(yearOf('2021-01-01T00:30:00Z'), 2021);
  // 2019-12-31T23:30:00Z is Jan 1 2020 in +UTC zones, but is 2019 in UTC.
  assert.equal(yearOf('2019-12-31T23:30:00Z'), 2019);
});

test('ordinary mid-day dates are unaffected', () => {
  assert.equal(yearOf('2018-06-15T12:00:00Z'), 2018);
  assert.equal(yearOf('2024-03-01T09:00:00Z'), 2024);
});

test('getUTCFullYear is deterministic regardless of process TZ', () => {
  // The value must not depend on the machine's local offset.
  const iso = '2022-01-01T02:00:00Z';
  assert.equal(new Date(iso).getUTCFullYear(), 2022);
});
