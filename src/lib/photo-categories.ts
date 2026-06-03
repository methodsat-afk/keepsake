/**
 * Fixed photo taxonomy. A curated, closed set keeps folder names predictable and
 * the gallery filter clean. The vision classifier maps each rescued photo to one
 * of these; anything unrecognized falls back to "Other". Pure module — no I/O —
 * so the mapping is unit-testable. See docs and PhotoGrid for consumers.
 */

export const PHOTO_CATEGORIES = [
  'People',
  'Kids',
  'Travel',
  'Celebrations',
  'Food',
  'Pets',
  'Nature',
  'Documents',
  'Other',
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const DEFAULT_CATEGORY: PhotoCategory = 'Other';

/** Display labels (with emoji) for the UI; storage uses the canonical key above. */
export const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  People: '👤 People',
  Kids: '🧒 Kids',
  Travel: '✈️ Travel',
  Celebrations: '🎉 Celebrations',
  Food: '🍽️ Food',
  Pets: '🐾 Pets',
  Nature: '🌲 Nature',
  Documents: '📄 Documents',
  Other: '🗂️ Other',
};

/**
 * Map a raw model token (any case / surrounding punctuation) to a canonical
 * category. Accepts a few natural synonyms so a slightly-off label still lands
 * somewhere sensible instead of defaulting to Other.
 */
const SYNONYMS: Record<string, PhotoCategory> = {
  people: 'People',
  person: 'People',
  portrait: 'People',
  portraits: 'People',
  family: 'People',
  group: 'People',
  kid: 'Kids',
  kids: 'Kids',
  child: 'Kids',
  children: 'Kids',
  baby: 'Kids',
  travel: 'Travel',
  place: 'Travel',
  places: 'Travel',
  vacation: 'Travel',
  trip: 'Travel',
  landmark: 'Travel',
  city: 'Travel',
  celebration: 'Celebrations',
  celebrations: 'Celebrations',
  party: 'Celebrations',
  birthday: 'Celebrations',
  wedding: 'Celebrations',
  holiday: 'Celebrations',
  event: 'Celebrations',
  food: 'Food',
  meal: 'Food',
  drink: 'Food',
  pet: 'Pets',
  pets: 'Pets',
  dog: 'Pets',
  cat: 'Pets',
  animal: 'Pets',
  animals: 'Pets',
  nature: 'Nature',
  landscape: 'Nature',
  outdoor: 'Nature',
  outdoors: 'Nature',
  scenery: 'Nature',
  document: 'Documents',
  documents: 'Documents',
  receipt: 'Documents',
  screenshot: 'Documents',
  other: 'Other',
  misc: 'Other',
  unknown: 'Other',
};

/** Normalize a raw classifier token to a canonical PhotoCategory. */
export function normalizeCategory(raw: string | null | undefined): PhotoCategory {
  if (!raw) return DEFAULT_CATEGORY;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return DEFAULT_CATEGORY;

  // Exact canonical match first.
  const exact = PHOTO_CATEGORIES.find((c) => c.toLowerCase() === cleaned);
  if (exact) return exact;

  // Synonym match.
  if (SYNONYMS[cleaned]) return SYNONYMS[cleaned];

  // Substring fallback (e.g. "travelphoto" → Travel).
  for (const [key, value] of Object.entries(SYNONYMS)) {
    if (cleaned.includes(key)) return value;
  }

  return DEFAULT_CATEGORY;
}

/** Make a category safe to use as a ZIP folder segment. */
export function categoryFolder(category: PhotoCategory): string {
  // Canonical names are already path-safe (single words), but guard anyway.
  return category.replace(/[\\/:*?"<>|]/g, '').trim() || DEFAULT_CATEGORY;
}

/** The label shown in the UI for a stored category (tolerates legacy nulls). */
export function categoryLabel(category: string | null | undefined): string {
  const normalized = normalizeCategory(category);
  return CATEGORY_LABELS[normalized];
}
