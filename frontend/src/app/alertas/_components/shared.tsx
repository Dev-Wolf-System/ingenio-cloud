'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { type Severity, SEVERITY_STYLE } from '../_types';

// ── NumberInput ──────────────────────────────────────────────────────────────

export function NumberInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      step="any"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      placeholder="—"
      className="w-24 mono tabular-nums text-sm bg-bg-card/60 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary-light/50"
    />
  );
}

// ── SeveritySelect ───────────────────────────────────────────────────────────

export function SeveritySelect({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (v: Severity) => void;
}) {
  const conf = SEVERITY_STYLE[value];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Severity)}
      className="text-xs mono uppercase tracking-wider rounded px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-primary-light"
      style={{
        background: conf.bg,
        borderColor: conf.color + '55',
        color: conf.color,
      }}
    >
      <option value="info">INFO</option>
      <option value="warn">ADVERTENCIA</option>
      <option value="critical">CRÍTICA</option>
    </select>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
      style={{
        background: enabled ? 'rgba(0,229,160,0.35)' : 'rgba(107,122,158,0.25)',
        boxShadow: enabled ? '0 0 12px rgba(0,229,160,0.35)' : 'none',
      }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: enabled ? 'translateX(20px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

// ── FilterPill ───────────────────────────────────────────────────────────────

export function FilterPill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs uppercase tracking-wider px-2.5 py-1 rounded transition-all"
      style={{
        background: active
          ? color
            ? `${color}26`
            : 'rgba(74,156,216,0.20)'
          : 'transparent',
        color: active ? (color ?? '#4FBFE5') : 'var(--text-muted, #6B7A9E)',
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </button>
  );
}

// ── LoadingState ─────────────────────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className="w-10 h-10 rounded-full animate-spin border-2 border-primary-light/20"
        style={{ borderTopColor: '#4FBFE5' }}
      />
      <p className="text-xs text-text-muted">Cargando sensores y umbrales…</p>
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <IconAlertTriangle size={28} className="text-text-muted/40" />
      <p className="text-xs text-text-muted">No hay sensores con el filtro actual.</p>
    </div>
  );
}
