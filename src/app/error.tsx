'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (will be replaced with structured logging)
    console.error('[App Error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="glass-panel max-w-md rounded-3xl p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-rose-500/20 p-4">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
        </div>

        <h2 className="mb-3 text-2xl font-bold text-white">
          Something went wrong
        </h2>

        <p className="mb-6 text-white/70">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {error.digest && (
          <p className="mb-6 font-mono text-xs text-white/40">
            Error ID: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-gray-900 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
