'use client';

import { useEffect, useRef, useState } from 'react';
import { Photo } from '@/types';
import { PhotoCard } from './PhotoCard';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface ScanProgressProps {
  initialStatus: string;
}

export function ScanProgress({ initialStatus }: ScanProgressProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [emailsProcessed, setEmailsProcessed] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (status === 'complete' || status === 'idle') return;

    const es = new EventSource('/api/scan/stream');
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      if (e.data === 'ping') return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'photo') {
          setPhotos((prev) => {
            if (prev.find((p) => p.id === msg.photo.id)) return prev;
            return [msg.photo, ...prev];
          });
        }
        if (msg.type === 'done') {
          setStatus(msg.status);
          es.close();
        }
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [status]);

  // Poll emails_processed from DB while scanning
  useEffect(() => {
    if (status !== 'running' && status !== 'scanning') return;
    const interval = setInterval(async () => {
      const res = await fetch('/api/scan/progress');
      if (res.ok) {
        const data = (await res.json()) as { emails_processed: number };
        setEmailsProcessed(data.emails_processed ?? 0);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === 'complete') {
    return (
      <div className="text-center">
        <div className="mb-6 text-6xl">🎉</div>
        <h2 className="mb-2 font-display text-4xl" style={{ color: 'var(--foreground)' }}>
          Scan complete!
        </h2>
        <p className="mb-8" style={{ color: 'var(--graphite)' }}>
          We found {photos.length} photo{photos.length !== 1 ? 's' : ''} in your inbox.
        </p>
        <Button onClick={() => router.push('/gallery')}>View my photos →</Button>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div
        className="scan-sweep mb-8 flex items-center justify-between rounded-2xl px-6 py-4"
        style={{ border: '1px solid var(--border)', background: 'var(--fog-gray)' }}
      >
        <div className="flex items-center gap-3">
          <span className="animate-scan-pulse relative flex h-3 w-3 rounded-full">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: 'var(--deep-blue)' }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ background: 'var(--deep-blue)' }}
            />
          </span>
          <span className="text-[15px] font-medium" style={{ color: 'var(--foreground)' }}>
            Scanning your inbox…
          </span>
        </div>
        <div className="flex gap-6 text-[13px]" style={{ color: 'var(--graphite)' }}>
          <span>
            <span className="font-medium" style={{ color: 'var(--foreground)' }}>
              {emailsProcessed}
            </span>{' '}
            emails checked
          </span>
          <span>
            <span className="font-medium" style={{ color: 'var(--deep-blue)' }}>
              {photos.length}
            </span>{' '}
            photos found
          </span>
        </div>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div
          className="scan-sweep flex h-64 items-center justify-center rounded-2xl border border-dashed"
          style={{ borderColor: 'var(--border)' }}
        >
          <p style={{ color: 'var(--steel-gray)' }}>
            Photos will appear here as we find them…
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} />
          ))}
        </div>
      )}
    </div>
  );
}
