import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCategory,
  categoryFolder,
  PHOTO_CATEGORIES,
  DEFAULT_CATEGORY,
  type PhotoCategory,
} from './photo-categories.ts';

test('exact canonical names map to themselves (case-insensitive)', () => {
  for (const c of PHOTO_CATEGORIES) {
    assert.equal(normalizeCategory(c), c);
    assert.equal(normalizeCategory(c.toUpperCase()), c);
    assert.equal(normalizeCategory(c.toLowerCase()), c);
  }
});

test('synonyms map to the right canonical category', () => {
  const cases: [string, PhotoCategory][] = [
    ['portrait', 'People'],
    ['family', 'People'],
    ['baby', 'Kids'],
    ['children', 'Kids'],
    ['vacation', 'Travel'],
    ['landmark', 'Travel'],
    ['birthday', 'Celebrations'],
    ['wedding', 'Celebrations'],
    ['meal', 'Food'],
    ['dog', 'Pets'],
    ['landscape', 'Nature'],
    ['receipt', 'Documents'],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(normalizeCategory(raw), expected, `${raw} → ${expected}`);
  }
});

test('messy tokens (punctuation, whitespace, casing) still normalize', () => {
  assert.equal(normalizeCategory('  Travel.  '), 'Travel');
  assert.equal(normalizeCategory('"Pets"'), 'Pets');
  assert.equal(normalizeCategory('KIDS!'), 'Kids');
});

test('substring fallback catches compound tokens', () => {
  assert.equal(normalizeCategory('travelphoto'), 'Travel');
  assert.equal(normalizeCategory('familyportrait'), 'People');
});

test('null / empty / unknown fall back to the default', () => {
  assert.equal(normalizeCategory(null), DEFAULT_CATEGORY);
  assert.equal(normalizeCategory(undefined), DEFAULT_CATEGORY);
  assert.equal(normalizeCategory(''), DEFAULT_CATEGORY);
  assert.equal(normalizeCategory('   '), DEFAULT_CATEGORY);
  assert.equal(normalizeCategory('zxqwv'), DEFAULT_CATEGORY);
});

test('normalizeCategory ALWAYS returns a member of the canonical set', () => {
  const samples = ['People', 'garbage', '', '🎉', 'dog', '123', 'TRAVEL', null, undefined];
  for (const s of samples) {
    assert.ok(
      (PHOTO_CATEGORIES as readonly string[]).includes(normalizeCategory(s)),
      `result for ${String(s)} must be canonical`
    );
  }
});

test('categoryFolder produces path-safe segments for every category', () => {
  for (const c of PHOTO_CATEGORIES) {
    const folder = categoryFolder(c);
    assert.ok(folder.length > 0);
    assert.ok(!/[\\/:*?"<>|]/.test(folder), `${folder} must have no path-unsafe chars`);
  }
});
