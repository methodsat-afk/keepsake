import { getAnthropic } from './client';
import {
  PHOTO_CATEGORIES,
  normalizeCategory,
  DEFAULT_CATEGORY,
  type PhotoCategory,
} from '@/lib/photo-categories';

export type ClassifyResult = 'PHOTO' | 'JUNK';

export interface ClassifyOutput {
  result: ClassifyResult;
  confidence: number;
  /** Canonical category for PHOTO results; DEFAULT_CATEGORY for junk/errors. */
  category: PhotoCategory;
}

/**
 * Uses Claude Haiku to (a) decide whether an image is a real family photo and
 * (b) assign it a category from the fixed taxonomy — both in ONE call, so there
 * is no extra API cost over the previous single-purpose classifier.
 *
 * Returns 'JUNK' / DEFAULT_CATEGORY on any error to avoid crashing the pipeline.
 * @param buffer - Raw image bytes
 * @param mimeType - MIME type of the image (e.g. image/jpeg)
 */
export async function classify(
  buffer: Buffer,
  mimeType: string
): Promise<ClassifyOutput> {
  try {
    const base64 = buffer.toString('base64');
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
    type ValidMediaType = typeof validMediaTypes[number];

    if (!validMediaTypes.includes(mimeType as ValidMediaType)) {
      return { result: 'JUNK', confidence: 0, category: DEFAULT_CATEGORY };
    }

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as ValidMediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text:
                "You are sorting someone's rescued photos. First decide if this is a real personal or family photo " +
                '(people, events, places someone actually photographed) versus JUNK (logos, icons, screenshots, ads, ' +
                'product images, decorative graphics). Then, if it is a photo, pick the single best category from this list:\n' +
                PHOTO_CATEGORIES.join(', ') + '.\n' +
                'Reply with exactly two words separated by a space: the verdict (PHOTO or JUNK) then the category ' +
                '(use Other for junk). Example: "PHOTO Travel".',
            },
          ],
        },
      ],
    });

    const raw = response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : 'JUNK Other';

    const [verdictToken, categoryToken] = raw.split(/\s+/, 2);
    const result: ClassifyResult =
      verdictToken?.toUpperCase().startsWith('PHOTO') ? 'PHOTO' : 'JUNK';
    // Haiku doesn't return confidence; use 0.9 for PHOTO, 0.1 for JUNK as a proxy
    const confidence = result === 'PHOTO' ? 0.9 : 0.1;
    const category: PhotoCategory =
      result === 'PHOTO' ? normalizeCategory(categoryToken) : DEFAULT_CATEGORY;

    console.log(`[classify] result=${result} category=${category} mime=${mimeType} size=${buffer.length}`);
    return { result, confidence, category };
  } catch (err) {
    console.error('[classify] error — defaulting to JUNK:', err);
    return { result: 'JUNK', confidence: 0, category: DEFAULT_CATEGORY };
  }
}
