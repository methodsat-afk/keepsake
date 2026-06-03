import { Suspense } from 'react';
import { DownloadContent } from './DownloadContent';

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center" style={{ background: 'var(--background)' }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20" style={{ borderTopColor: 'var(--or)' }} />
        </main>
      }
    >
      <DownloadContent />
    </Suspense>
  );
}
