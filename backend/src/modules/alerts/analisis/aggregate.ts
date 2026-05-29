import { normalizeSeverity } from '../severity';
import type { AlertaRow, ParadaRow, Kpis, SensorStat, Correlacion } from './analisis.types';

const min = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;

export function computeKpis(alerts: AlertaRow[]): Kpis {
  const por_severidad = { info: 0, warn: 0, critical: 0 };
  const por_area: Record<string, number> = {};
  const durs: number[] = [];
  for (const a of alerts) {
    por_severidad[normalizeSeverity(a.severity)]++;
    por_area[a.area] = (por_area[a.area] ?? 0) + 1;
    if (a.resolved_at) durs.push(min(a.detected_at, a.resolved_at));
  }
  const sorted = alerts.map((a) => new Date(a.detected_at).getTime()).sort((x, y) => x - y);
  let mtbf: number | null = null;
  if (sorted.length > 1) {
    let sum = 0;
    for (let i = 1; i < sorted.length; i++) sum += (sorted[i] - sorted[i - 1]) / 60_000;
    mtbf = Number((sum / (sorted.length - 1)).toFixed(1));
  }
  return {
    total: alerts.length,
    por_severidad,
    por_area,
    duracion_media_min: durs.length ? Number((durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(1)) : 0,
    duracion_max_min: durs.length ? Number(Math.max(...durs).toFixed(1)) : 0,
    mtbf_min: mtbf,
  };
}

export function sensoresStats(alerts: AlertaRow[]): SensorStat[] {
  const groups = new Map<string, AlertaRow[]>();
  for (const a of alerts) {
    const k = `${a.area}::${a.source.split('::').pop() ?? a.title}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  return Array.from(groups.entries()).map(([k, rows]) => {
    const [area, key] = k.split('::');
    const times = rows.map((r) => new Date(r.detected_at).getTime()).sort((x, y) => x - y);
    let mtbf: number | null = null;
    if (times.length > 1) {
      let s = 0; for (let i = 1; i < times.length; i++) s += (times[i] - times[i - 1]) / 60_000;
      mtbf = Number((s / (times.length - 1)).toFixed(1));
    }
    const durs = rows.filter((r) => r.resolved_at).map((r) => min(r.detected_at, r.resolved_at!));
    return {
      area, key, titulo: key.replace(/_/g, ' '),
      n: rows.length, mtbf_min: mtbf,
      duracion_media_min: durs.length ? Number((durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.n - a.n);
}

export function correlaciones(alerts: AlertaRow[], ventanaMin: number): Correlacion[] {
  const pares = new Map<string, number>();
  const key = (a: AlertaRow) => `${a.area}:${a.source.split('::').pop() ?? a.title}`;
  for (let i = 0; i < alerts.length; i++) {
    for (let j = i + 1; j < alerts.length; j++) {
      if (min(alerts[i].detected_at, alerts[j].detected_at) > ventanaMin) continue;
      const ka = key(alerts[i]); const kb = key(alerts[j]);
      if (ka === kb) continue;
      const pk = [ka, kb].sort().join(' ↔ ');
      pares.set(pk, (pares.get(pk) ?? 0) + 1);
    }
  }
  return Array.from(pares.entries())
    .map(([pk, juntas]) => { const [a, b] = pk.split(' ↔ '); return { a, b, juntas, ventana_min: ventanaMin }; })
    .sort((x, y) => y.juntas - x.juntas)
    .slice(0, 10);
}

export function cruzarParadas(alerts: AlertaRow[], paradas: ParadaRow[], antesMin: number, despuesMin: number): ParadaRow[] {
  return paradas.map((p) => {
    const ini = new Date(p.inicio).getTime();
    const fin = p.fin ? new Date(p.fin).getTime() : ini;
    const desde = ini - antesMin * 60_000;
    const hasta = fin + despuesMin * 60_000;
    const rel = alerts
      .filter((a) => { const t = new Date(a.detected_at).getTime(); return t >= desde && t <= hasta; })
      .map((a) => ({
        id: a.id, titulo: a.title, severidad: normalizeSeverity(a.severity),
        detected_at: a.detected_at,
        offset_min: Number(((new Date(a.detected_at).getTime() - ini) / 60_000).toFixed(0)),
      }));
    return { ...p, alertas_relacionadas: rel };
  });
}
