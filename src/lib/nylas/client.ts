import Nylas from 'nylas';

/** Singleton Nylas SDK instance authenticated with the API key. */
export const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY!,
  apiUri: process.env.NYLAS_API_URI ?? 'https://api.us.nylas.com',
});
