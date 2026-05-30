export type Severity = 'info' | 'warn' | 'critical';

export function normalizeSeverity(s: string): Severity {
  if (s === 'critical') return 'critical';
  if (s === 'warn' || s === 'warning') return 'warn';
  return s === 'info' ? 'info' : 'info';
}
export const SEV_ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };
