export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/scan/stream
 * Server-Sent Events endpoint that streams new photos to the client in real time.
 * Polls the Supabase photos table every 2 seconds and pushes any new rows.
 * Sends a heartbeat ping every 15 seconds to keep the connection alive.
 * Closes automatically when the scan is marked complete.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const serviceClient = createServiceClient();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let lastPhotoCreatedAt = new Date(0).toISOString();
      let closed = false;

      const send = (data: string) => {
        if (!closed) {
          controller.enqueue(enc.encode(`data: ${data}\n\n`));
        }
      };

      const close = () => {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      // Abort when client disconnects
      request.signal.addEventListener('abort', close);

      const heartbeatTimer = setInterval(() => send('ping'), 15000);

      const poll = async () => {
        if (closed) return;

        try {
          // Get the latest scan for this user
          const { data: scan } = await serviceClient
            .from('scans')
            .select('id, status')
            .eq('user_id', user.id)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          if (!scan) return;

          // Fetch any new photos since last poll
          const { data: photos } = await serviceClient
            .from('photos')
            .select('*')
            .eq('user_id', user.id)
            .eq('scan_id', scan.id)
            .gt('created_at', lastPhotoCreatedAt)
            .order('created_at', { ascending: true });

          if (photos && photos.length > 0) {
            for (const photo of photos) {
              send(JSON.stringify({ type: 'photo', photo }));
            }
            lastPhotoCreatedAt = photos[photos.length - 1].created_at;
          }

          if (scan.status === 'complete' || scan.status === 'error') {
            send(JSON.stringify({ type: 'done', status: scan.status }));
            clearInterval(heartbeatTimer);
            close();
            return;
          }
        } catch (err) {
          console.error('[stream] poll error:', err);
        }

        if (!closed) setTimeout(poll, 2000);
      };

      // Start polling
      setTimeout(poll, 500);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
