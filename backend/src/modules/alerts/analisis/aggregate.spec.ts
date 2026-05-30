import { computeKpis, sensoresStats, correlaciones, cruzarParadas, reliabilidad } from './aggregate';
import type { AlertaRow, ParadaRow } from './analisis.types';

const mk = (id: string, sev: string, area: string, key: string, det: string, res: string | null, ack: string | null = null): AlertaRow => ({
  id, severity: sev, area, source: `threshold::${area}::${key}`, title: key, detected_at: det, resolved_at: res, acknowledged_at: ack,
});

describe('aggregate', () => {
  const alerts: AlertaRow[] = [
    mk('1', 'warn', 'energia', 'presion', '2026-05-29T13:00:00-03:00', '2026-05-29T13:10:00-03:00'),
    mk('2', 'critical', 'energia', 'temp', '2026-05-29T13:05:00-03:00', '2026-05-29T13:40:00-03:00'),
    mk('3', 'warn', 'energia', 'presion', '2026-05-29T15:00:00-03:00', null),
  ];

  it('kpis', () => {
    const k = computeKpis(alerts);
    expect(k.total).toBe(3);
    expect(k.por_severidad.warn).toBe(2);
    expect(k.por_severidad.critical).toBe(1);
    expect(k.duracion_media_min).toBe(22.5);
  });
  it('sensores agrupa por area::key', () => {
    const s = sensoresStats(alerts);
    expect(s.find((x) => x.key === 'presion')!.n).toBe(2);
  });
  it('correlaciones dentro de ventana', () => {
    const c = correlaciones(alerts, 15);
    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c[0].juntas).toBeGreaterThanOrEqual(1);
  });
  it('cruzarParadas asocia alertas en [inicio-30, fin+10]', () => {
    const paradas: ParadaRow[] = [{
      inicio: '2026-05-29T13:20:00-03:00', fin: '2026-05-29T13:50:00-03:00', minutos: 30,
      motivo: 'x', maquina: 'cald', origen: 'Calderas', alertas_relacionadas: [],
    }];
    const out = cruzarParadas(alerts, paradas, 30, 10);
    expect(out[0].alertas_relacionadas.length).toBeGreaterThanOrEqual(1);
    expect(out[0].alertas_relacionadas[0].offset_min).toBeDefined();
  });

  it('reliabilidad: MTBF=MTTF+MTTR, MTTR=downtime/n, MTTA sobre acks', () => {
    // span 480 min (8h), 2 paradas, downtime 30+50=80 → operating 400
    const paradas: ParadaRow[] = [
      { inicio: '2026-05-29T13:20:00-03:00', fin: '2026-05-29T13:50:00-03:00', minutos: 30, motivo: 'a', maquina: null, origen: null, alertas_relacionadas: [] },
      { inicio: '2026-05-29T16:00:00-03:00', fin: '2026-05-29T16:50:00-03:00', minutos: 50, motivo: 'b', maquina: null, origen: null, alertas_relacionadas: [] },
    ];
    // alerta 1 reconocida 5 min después
    const al = [mk('1', 'warn', 'energia', 'presion', '2026-05-29T13:00:00-03:00', null, '2026-05-29T13:05:00-03:00')];
    const r = reliabilidad(al, paradas, 480);
    expect(r.paradas_n).toBe(2);
    expect(r.downtime_total_min).toBe(80);
    expect(r.operating_min).toBe(400);
    expect(r.mttr_min).toBe(40);   // 80/2
    expect(r.mttf_min).toBe(200);  // 400/2
    expect(r.mtbf_min).toBe(240);  // 480/2 = MTTF+MTTR = 200+40
    expect(r.mtta_min).toBe(5);
  });

  it('reliabilidad: sin paradas → métricas null', () => {
    const r = reliabilidad([], [], 480);
    expect(r.paradas_n).toBe(0);
    expect(r.mtbf_min).toBeNull();
    expect(r.mttr_min).toBeNull();
  });
});
