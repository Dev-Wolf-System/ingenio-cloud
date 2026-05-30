export const ESCALATE_AFTER_MIN = 5;
export const ESCALATE_DRIFT_PCT = 10;

export interface EscalateInput {
  severity: string;
  detectedAt: string;
  value: number;
  min: number | null;
  max: number | null;
  afterMin: number | null;
  driftPct: number | null;
  enabled: boolean;
}

export type EscalateResult =
  | { escalate: true; reason: 'persistencia' | 'tendencia' }
  | { escalate: false; reason: null };

export function shouldEscalate(i: EscalateInput): EscalateResult {
  if (!i.enabled) return { escalate: false, reason: null };
  if (i.severity === 'critical') return { escalate: false, reason: null };

  const afterMin = i.afterMin ?? ESCALATE_AFTER_MIN;
  const driftPct = i.driftPct ?? ESCALATE_DRIFT_PCT;

  let drift = 0;
  if (i.max != null && i.value > i.max && i.max !== 0) {
    drift = ((i.value - i.max) / Math.abs(i.max)) * 100;
  } else if (i.min != null && i.value < i.min && i.min !== 0) {
    drift = ((i.min - i.value) / Math.abs(i.min)) * 100;
  }
  if (drift >= driftPct) return { escalate: true, reason: 'tendencia' };

  const ageMin = (Date.now() - new Date(i.detectedAt).getTime()) / 60_000;
  if (ageMin >= afterMin) return { escalate: true, reason: 'persistencia' };

  return { escalate: false, reason: null };
}
