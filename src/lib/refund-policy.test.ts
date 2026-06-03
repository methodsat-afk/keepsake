import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRefund, REFUND_WINDOW_DAYS, type RefundContext } from './refund-policy.ts';

const NOW = 1_700_000_000; // fixed "now"
const DAY = 86_400;

function ctx(overrides: Partial<RefundContext> = {}): RefundContext {
  return {
    hasPaid: true,
    paymentIntentId: 'pi_123',
    piCreatedUnix: NOW - 5 * DAY, // 5 days ago
    piStatus: 'succeeded',
    alreadyRefunded: false,
    nowUnix: NOW,
    ...overrides,
  };
}

test('happy path: recent succeeded payment → refund', () => {
  assert.deepEqual(decideRefund(ctx()), { action: 'refund' });
});

test('not paid → reject 400', () => {
  const d = decideRefund(ctx({ hasPaid: false }));
  assert.equal(d.action, 'reject');
  if (d.action === 'reject') assert.equal(d.status, 400);
});

test('no payment intent → reject 400', () => {
  const d = decideRefund(ctx({ paymentIntentId: null }));
  assert.equal(d.action, 'reject');
  if (d.action === 'reject') assert.equal(d.status, 400);
});

test('outside the 30-day window → reject 422', () => {
  const d = decideRefund(ctx({ piCreatedUnix: NOW - (REFUND_WINDOW_DAYS + 1) * DAY }));
  assert.equal(d.action, 'reject');
  if (d.action === 'reject') assert.match(d.reason, /money-back window/);
});

test('exactly at the window boundary is still allowed', () => {
  // 30.0 days old — not strictly greater than 30, so allowed.
  const d = decideRefund(ctx({ piCreatedUnix: NOW - REFUND_WINDOW_DAYS * DAY }));
  assert.equal(d.action, 'refund');
});

test('payment not succeeded → reject 422', () => {
  const d = decideRefund(ctx({ piStatus: 'processing' }));
  assert.equal(d.action, 'reject');
  if (d.action === 'reject') assert.equal(d.status, 422);
});

test('PI not retrievable (created null) → reject 422', () => {
  const d = decideRefund(ctx({ piCreatedUnix: null }));
  assert.equal(d.action, 'reject');
});

test('already refunded → already_refunded (no double refund)', () => {
  assert.deepEqual(decideRefund(ctx({ alreadyRefunded: true })), { action: 'already_refunded' });
});

test('already-refunded takes precedence over issuing a new refund', () => {
  // Even a perfectly valid recent payment must not be refunded twice.
  const d = decideRefund(ctx({ alreadyRefunded: true, piCreatedUnix: NOW - DAY }));
  assert.equal(d.action, 'already_refunded');
});
