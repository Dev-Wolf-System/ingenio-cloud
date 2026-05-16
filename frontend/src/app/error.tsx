'use client';

import { useEffect } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-bg-base">
      <div className="max-w-md w-full rounded-xl border border-danger/30 bg-bg-card p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-lg bg-danger-soft text-danger flex items-center justify-center mb-3">
          <IconAlertTriangle size={24} />
        </div>
        <h1 className="font-display text-lg font-semibold text-text-primary mb-1">
          Algo falló en el dashboard
        </h1>
        <p className="text-xs text-text-muted mb-4 mono">
          {error.message ?? 'Error desconocido'}
          {error.digest && <span className="block opacity-50 mt-1">ID: {error.digest}</span>}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
