'use client';

import { useQuery } from '@tanstack/react-query';

export interface Threshold {
  id: string;
  area: 'energia' | 'produccion' | 'trapiche';
  key: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
  severity: 'info' | 'warn' | 'critical';
  notes: string | null;
}

export interface ThresholdEvaluation {
  status: 'ok' | 'out';
  severity: 'info' | 'warn' | 'critical' | null;
  reason: 'low' | 'high' | null;
  threshold: Threshold | null;
}

async function fetchThresholds(): Promise<Threshold[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';
  const res = await fetch(`${apiUrl}/alerts/thresholds`);
  if (!res.ok) return [];
  const json = (await res.json()) as { thresholds: Threshold[] };
  return json.thresholds ?? [];
}

/** Hook global: lee thresholds cada 60s (cambian poco) */
export function useThresholds() {
  return useQuery({
    queryKey: ['alerts', 'thresholds'],
    queryFn: fetchThresholds,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Helper: evalúa un valor contra thresholds */
export function evaluateValue(
  thresholds: Threshold[] | undefined,
  area: string,
  key: string,
  value: number | null | undefined,
): ThresholdEvaluation {
  if (!thresholds || typeof value !== 'number' || !Number.isFinite(value)) {
    return { status: 'ok', severity: null, reason: null, threshold: null };
  }
  const rule = thresholds.find(
    (t) => t.enabled && t.area === area && t.key === key,
  );
  if (!rule) return { status: 'ok', severity: null, reason: null, threshold: null };

  if (rule.min_value != null && value < rule.min_value) {
    return { status: 'out', severity: rule.severity, reason: 'low', threshold: rule };
  }
  if (rule.max_value != null && value > rule.max_value) {
    return { status: 'out', severity: rule.severity, reason: 'high', threshold: rule };
  }
  return { status: 'ok', severity: null, reason: null, threshold: rule };
}
