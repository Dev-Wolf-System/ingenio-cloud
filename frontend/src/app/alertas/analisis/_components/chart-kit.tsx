'use client';

// ── Shared palette & tooltip for the Análisis panel ───────────────────────────

export const C = {
  cyan:    '#00D4FF',
  amber:   '#FFB800',
  green:   '#00E5A0',
  red:     '#FF4757',
  indigo:  '#6366F1',
} as const;

// ── Glass tooltip ─────────────────────────────────────────────────────────────

export function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number | string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm lg:text-base"
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {label && (
        <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}:{' '}
          <span className="font-bold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Severity color ────────────────────────────────────────────────────────────

export function sevColor(sev: string): string {
  if (sev === 'critical') return C.red;
  if (sev === 'warn')     return C.amber;
  return C.cyan;
}

// ── Format minutes ────────────────────────────────────────────────────────────

export function fmtMin(m: number | null): string {
  if (m === null) return '—';
  if (m >= 120) return `${(m / 60).toFixed(1)} h`;
  return `${m} min`;
}
