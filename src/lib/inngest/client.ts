import { Inngest } from 'inngest';

/** Singleton Inngest client for sending and receiving events. */
export const inngest = new Inngest({
  id: 'keepsake',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
