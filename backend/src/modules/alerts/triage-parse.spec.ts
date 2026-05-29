import { parseTriage, alertsHash } from './triage-parse';

describe('triage-parse', () => {
  it('parsea respuesta válida y normaliza severidad', () => {
    const raw = JSON.stringify({ alerts: [
      { id: 'a', severidad_recalibrada: 'warning', grupo_causa: 'vapor', prioridad: 1, titular: 'T', recomendacion: 'R' },
    ]});
    const out = parseTriage(raw);
    expect(out['a'].severidad).toBe('warn');
    expect(out['a'].grupo).toBe('vapor');
    expect(out['a'].prioridad).toBe(1);
  });
  it('devuelve {} ante JSON inválido', () => {
    expect(parseTriage('no json')).toEqual({});
  });
  it('hash estable ante mismo set, distinto ante cambio', () => {
    const a = [{ id: '1', value: 10 }, { id: '2', value: 20 }];
    const b = [{ id: '2', value: 20 }, { id: '1', value: 10 }];
    const c = [{ id: '1', value: 11 }, { id: '2', value: 20 }];
    expect(alertsHash(a)).toBe(alertsHash(b));
    expect(alertsHash(a)).not.toBe(alertsHash(c));
  });
});
