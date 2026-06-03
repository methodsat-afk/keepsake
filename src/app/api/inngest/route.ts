import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { scanInbox } from '@/lib/inngest/functions/scan-inbox';
import { filterPhoto } from '@/lib/inngest/functions/filter-photo';
import { scanJunk } from '@/lib/inngest/functions/scan-junk';
import { classifyJunkItem } from '@/lib/inngest/functions/classify-junk-item';
import { measureClearable } from '@/lib/inngest/functions/measure-clearable';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanInbox, filterPhoto, scanJunk, classifyJunkItem, measureClearable],
});
