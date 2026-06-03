import Anthropic from '@anthropic-ai/sdk';

/**
 * Lazily-created Anthropic client for server-side use only.
 *
 * IMPORTANT: do NOT instantiate at module load. A top-level `new Anthropic(...)`
 * reads process.env exactly once at import time; if the env isn't resolved at
 * that moment the apiKey is captured as undefined forever (the cause of the
 * "Could not resolve authentication method" classifier failures). Creating it on
 * first use — like createServiceClient() does for Supabase — reads the env at
 * call time and is robust to import ordering.
 */
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in the environment');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
