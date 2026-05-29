import { normalizeSeverity, Severity } from './severity';

export interface TriageEntry {
  severidad: Severity;
  grupo: string;
  prioridad: number;
  titular: string;
  recomendacion: string;
}

export function parseTriage(raw: string): Record<string, TriageEntry> {
  const out: Record<string, TriageEntry> = {};
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return out;
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      alerts?: Array<Record<string, unknown>>;
    };
    for (const a of obj.alerts ?? []) {
      const id = String(a.id ?? '');
      if (!id) continue;
      out[id] = {
        severidad: normalizeSeverity(String(a.severidad_recalibrada ?? 'info')),
        grupo: String(a.grupo_causa ?? 'general'),
        prioridad: Number(a.prioridad ?? 99),
        titular: String(a.titular ?? ''),
        recomendacion: String(a.recomendacion ?? ''),
      };
    }
  } catch { /* {} */ }
  return out;
}

export function alertsHash(alerts: Array<{ id: string; value?: number | null }>): string {
  return alerts
    .map((a) => `${a.id}:${a.value ?? ''}`)
    .sort()
    .join('|');
}
