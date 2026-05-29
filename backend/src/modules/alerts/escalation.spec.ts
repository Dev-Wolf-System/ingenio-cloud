import { shouldEscalate } from './escalation';

const base = { detectedAt: new Date(Date.now() - 6 * 60_000).toISOString(), severity: 'warn' as const };

describe('shouldEscalate', () => {
  it('escala por persistencia >= 5min default', () => {
    const r = shouldEscalate({ ...base, value: 23, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(true);
    expect(r.reason).toBe('persistencia');
  });
  it('escala por drift >= 10% aunque sea reciente', () => {
    const recent = { ...base, detectedAt: new Date().toISOString() };
    const r = shouldEscalate({ ...recent, value: 25, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(true);
    expect(r.reason).toBe('tendencia');
  });
  it('no escala si reciente y dentro del 10%', () => {
    const recent = { ...base, detectedAt: new Date().toISOString() };
    const r = shouldEscalate({ ...recent, value: 22.5, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(false);
  });
  it('no escala alertas que ya son critical', () => {
    const r = shouldEscalate({ ...base, severity: 'critical', value: 30, min: null, max: 22, afterMin: null, driftPct: null });
    expect(r.escalate).toBe(false);
  });
  it('respeta override por umbral', () => {
    const recent = { ...base, detectedAt: new Date(Date.now() - 2 * 60_000).toISOString() };
    const r = shouldEscalate({ ...recent, value: 23, min: null, max: 22, afterMin: 1, driftPct: null });
    expect(r.escalate).toBe(true);
  });
});
