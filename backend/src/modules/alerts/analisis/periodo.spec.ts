process.env.TZ = 'America/Argentina/Buenos_Aires';
import { rangoPeriodo } from './periodo';

describe('rangoPeriodo', () => {
  const ref = new Date('2026-05-29T15:30:00-03:00'); // 15:30 ART → turno Tarde (13-21)

  it('turno: ventana del turno actual + anterior', () => {
    const r = rangoPeriodo('turno', ref);
    expect(r.desde.getHours()).toBe(13);
    expect(r.hasta.getTime() - r.desde.getTime()).toBe(8 * 3600_000);
    expect(r.prevDesde!.getHours()).toBe(5);
  });
  it('dia: día industrial corriente + anterior', () => {
    const r = rangoPeriodo('dia', ref);
    expect(r.hasta.getTime() - r.desde.getTime()).toBe(24 * 3600_000);
    expect(r.prevDesde).not.toBeNull();
  });
  it('zafra: desde inicio zafra (param) sin comparativa', () => {
    const r = rangoPeriodo('zafra', ref, new Date('2026-05-01T00:00:00-03:00'));
    expect(r.desde.toISOString()).toContain('2026-05-01');
    expect(r.prevDesde).toBeNull();
  });
});
