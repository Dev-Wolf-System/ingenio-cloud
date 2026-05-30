'use client';

export function AnalisisAzucarModal() {
  return (
    <button
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--primary-light)',
        background: 'var(--bg-card)',
      }}
      type="button"
    >
      Análisis de Azúcar
    </button>
  );
}
