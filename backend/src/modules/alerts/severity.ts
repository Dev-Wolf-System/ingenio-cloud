export type Severity = 'info' | 'warn' | 'critical';

export function normalizeSeverity(s: string): Severity {
  if (s === 'critical') return 'critical';
  if (s === 'warn' || s === 'warning') return 'warn';
  if (s === 'info') return 'info';
  return 'info';
}

const ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };
export function sevOrder(s: string): number {
  return ORDER[normalizeSeverity(s)];
}

export function sevLabel(s: string): string {
  const n = normalizeSeverity(s);
  return n === 'critical' ? 'crítica' : n === 'warn' ? 'de advertencia' : 'informativa';
}
