import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierFromSignals, AUTO_CONFIDENCE_THRESHOLD, type JunkSignals } from './junk-tier.ts';

/**
 * Tests for the safety-critical PURE tiering gate. Run with:
 *   node --test --experimental-strip-types src/lib/claude/classify-junk.test.ts
 */

// A baseline "obvious bulk mail" signal set; tests override fields as needed.
function base(overrides: Partial<JunkSignals> = {}): JunkSignals {
  return {
    category: 'CATEGORY_PROMOTIONS',
    hasListUnsubscribe: true,
    isStarred: false,
    isImportant: false,
    hasUserReply: false,
    hasRescuedAttachment: false,
    sender: 'deals@retailer.com',
    subject: '50% off everything this weekend',
    snippet: null,
    ...overrides,
  };
}

test('full bulk fingerprint → auto tier, high confidence', () => {
  const r = tierFromSignals(base());
  assert.equal(r.tier, 'auto');
  assert.ok(r.confidence >= AUTO_CONFIDENCE_THRESHOLD, 'auto must clear the threshold');
  assert.equal(r.needsLlm, false);
});

test('promotions WITHOUT unsubscribe → review, not auto', () => {
  const r = tierFromSignals(base({ hasListUnsubscribe: false }));
  assert.equal(r.tier, 'review');
  assert.notEqual(r.tier, 'auto');
});

test('unsubscribe present but NOT a bulk category → review, not auto', () => {
  const r = tierFromSignals(base({ category: 'CATEGORY_UPDATES' }));
  assert.equal(r.tier, 'review');
});

test('starred is always protected, even with full bulk fingerprint', () => {
  const r = tierFromSignals(base({ isStarred: true }));
  assert.equal(r.tier, 'protected');
});

test('important is always protected', () => {
  const r = tierFromSignals(base({ isImportant: true }));
  assert.equal(r.tier, 'protected');
});

test('user replied in thread → protected', () => {
  const r = tierFromSignals(base({ hasUserReply: true }));
  assert.equal(r.tier, 'protected');
});

test('message with a rescued photo → protected', () => {
  const r = tierFromSignals(base({ hasRescuedAttachment: true }));
  assert.equal(r.tier, 'protected');
});

test('personal category → protected', () => {
  const r = tierFromSignals(base({ category: 'CATEGORY_PERSONAL' }));
  assert.equal(r.tier, 'protected');
});

test('financial keyword in sender prevents auto-trash (demoted to review)', () => {
  // Even with a perfect bulk fingerprint, a bank sender must never auto-trash.
  const r = tierFromSignals(base({ sender: 'alerts@mybank.com' }));
  assert.equal(r.tier, 'review');
  assert.notEqual(r.tier, 'auto');
});

test('tax keyword in subject prevents auto-trash', () => {
  const r = tierFromSignals(base({ subject: 'Your 2025 tax statement is ready' }));
  assert.equal(r.tier, 'review');
});

test('plain personal-looking mail with no bulk signals → review/keep, never auto', () => {
  const r = tierFromSignals(base({
    category: null,
    hasListUnsubscribe: false,
    sender: 'aunt.sue@gmail.com',
    subject: 'Re: dinner next week',
  }));
  assert.equal(r.tier, 'review');
  assert.notEqual(r.tier, 'auto');
});

test('CATEGORY_SOCIAL with unsubscribe → auto (social bulk notifications)', () => {
  const r = tierFromSignals(base({ category: 'CATEGORY_SOCIAL' }));
  assert.equal(r.tier, 'auto');
});

test('INVARIANT: only auto tier can exceed the auto confidence threshold', () => {
  // Sweep a representative matrix; assert nothing non-auto ever clears the bar.
  const categories = [null, 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_PERSONAL'];
  const bools = [true, false];
  for (const category of categories) {
    for (const hasListUnsubscribe of bools) {
      for (const isStarred of bools) {
        for (const isImportant of bools) {
          for (const hasUserReply of bools) {
            for (const hasRescuedAttachment of bools) {
              const r = tierFromSignals({
                category,
                hasListUnsubscribe,
                isStarred,
                isImportant,
                hasUserReply,
                hasRescuedAttachment,
                sender: 'someone@example.com',
                subject: 'hello there',
              });
              if (r.tier !== 'auto') {
                assert.ok(
                  r.confidence < AUTO_CONFIDENCE_THRESHOLD,
                  `non-auto tier "${r.tier}" must stay below auto threshold (got ${r.confidence})`
                );
              }
            }
          }
        }
      }
    }
  }
});
