'use client';

import { useEffect } from 'react';

/**
 * Top-level error boundary that catches errors in the root layout itself.
 * Must render its own <html>/<body> because it replaces the whole document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <h1 style={{ fontSize: '28px', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#4d4d4d', maxWidth: '28rem', marginTop: '12px' }}>
          We hit an unexpected error. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '24px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 500,
            color: '#fff',
            background: '#5f79ff',
            border: 'none',
            borderRadius: '100px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
