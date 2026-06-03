import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierForBytes, formatGb, PRICING_TIERS } from './pricing.ts';

const GB = 1024 * 1024 * 1024;

test('under 2 GB → tidy ($19)', () => {
  assert.equal(tierForBytes(0).id, 'tidy');
  assert.equal(tierForBytes(500 * 1024 * 1024).id, 'tidy');
  assert.equal(tierForBytes(2 * GB - 1).id, 'tidy');
  assert.equal(tierForBytes(2 * GB - 1).priceUsd, 19);
});

test('2 GB to under 8 GB → reclaim ($29)', () => {
  assert.equal(tierForBytes(2 * GB).id, 'reclaim');
  assert.equal(tierForBytes(4.1 * GB).id, 'reclaim');
  assert.equal(tierForBytes(8 * GB - 1).id, 'reclaim');
  assert.equal(tierForBytes(4 * GB).priceUsd, 29);
});

test('8 GB and up → major ($49)', () => {
  assert.equal(tierForBytes(8 * GB).id, 'major');
  assert.equal(tierForBytes(20 * GB).id, 'major');
  assert.equal(tierForBytes(8 * GB).priceUsd, 49);
});

test('boundaries are exact and non-overlapping', () => {
  // Exactly at each boundary picks the higher tier.
  assert.equal(tierForBytes(2 * GB).id, 'reclaim');
  assert.equal(tierForBytes(8 * GB).id, 'major');
});

test('garbage / negative / NaN inputs fall back to the lowest tier (never crash)', () => {
  assert.equal(tierForBytes(-100).id, 'tidy');
  assert.equal(tierForBytes(NaN).id, 'tidy');
  assert.equal(tierForBytes(Infinity).id, 'tidy'); // non-finite is garbage -> safest (cheapest) tier
});

test('tierForBytes ALWAYS returns a real configured tier', () => {
  for (const b of [0, 1, 2 * GB, 8 * GB, 100 * GB, -5, NaN]) {
    const t = tierForBytes(b);
    assert.ok(PRICING_TIERS.some((x) => x.id === t.id), `must be a real tier for ${b}`);
  }
});

test('formatGb renders sensibly', () => {
  assert.equal(formatGb(0), '0 GB');
  assert.equal(formatGb(4.1 * GB), '4.1 GB');
  assert.equal(formatGb(12 * GB), '12 GB');
  // sub-0.1 GB shows MB
  assert.match(formatGb(50 * 1024 * 1024), /MB$/);
});
