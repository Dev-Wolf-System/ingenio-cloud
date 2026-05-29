import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { sevLabel, sevOrder, normalizeSeverity } from './severity';
import { getCurrentShift } from '../../common/shift';

// ── Helpers TTS ──────────────────────────────────────────────────────────────

/** Convierte número a palabras en español rioplatense para que TTS no lo pronuncie en inglés */
function numEs(n: number): string {
  if (!isFinite(n)) return String(n);

  // Decimales: separar en parte entera + décimas
  if (!Number.isInteger(n)) {
    const fixed = parseFloat(n.toFixed(1));
    const intPart = Math.trunc(fixed);
    const decPart = Math.round(Math.abs(fixed - intPart) * 10);
    return decPart === 0 ? numEs(intPart) : `${numEs(intPart)} coma ${numEs(decPart)}`;
  }

  if (n < 0) return `menos ${numEs(-n)}`;
  if (n === 0) return 'cero';

  const ONES = [
    '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  ];
  const TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const HUNDREDS = [
    '', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
  ];

  if (n < 20) return ONES[n];
  if (n < 30) return n === 20 ? 'veinte' : `veinti${ONES[n - 20]}`;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? TENS[t] : `${TENS[t]} y ${ONES[o]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const hStr = h === 1 && rest > 0 ? 'ciento' : HUNDREDS[h];
    return rest === 0 ? hStr : `${hStr} ${numEs(rest)}`;
  }
  if (n < 10_000) {
    const k = Math.floor(n / 1000);
    const rest = n % 1000;
    const kStr = k === 1 ? 'mil' : `${numEs(k)} mil`;
    return rest === 0 ? kStr : `${kStr} ${numEs(rest)}`;
  }
  // Números grandes: pronunciar cifras individuales para no perder contexto
  return String(n).split('').join(' ');
}

/** Normaliza unidades técnicas a texto hablable en español */
function unitEs(unit: string): string {
  const MAP: Record<string, string> = {
    '°C':   'grados',
    '°F':   'grados Fahrenheit',
    'ºC':   'grados',
    '%':    'por ciento',
    't/h':  'toneladas por hora',
    'Tn/H': 'toneladas por hora',
    'tn/h': 'toneladas por hora',
    'm³/h': 'metros cúbicos por hora',
    'm3/h': 'metros cúbicos por hora',
    'm³':   'metros cúbicos',
    'm3':   'metros cúbicos',
    'MW':   'megavatios',
    'kW':   'kilovatios',
    'kWh':  'kilovatios hora',
    'bar':  'bar',
    'pH':   '',              // "pH" se pronuncia bien solo
    'rpm':  'revoluciones por minuto',
    'kg':   'kilogramos',
    'kg/h': 'kilogramos por hora',
    'L/h':  'litros por hora',
    'l/h':  'litros por hora',
    'psi':  'psi',
    'V':    'voltios',
    'A':    'amperes',
    'Hz':   'hertz',
  };
  return MAP[unit] ?? unit;
}

interface AlertRow {
  id: string;
  severity: string;
  area: string;
  source: string;
  title: string;
  message: string;
  suggested_action: string | null;
  metadata: { value?: number; min_value?: number; max_value?: number; unit?: string; updated_at?: string };
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

interface CausaCache {
  result: { causa_probable: string; factores_contribuyentes: string[]; acciones_sugeridas: string[] };
  ts: number;
  metaKey: string; // metadata.value+updated_at para invalidar si cambia
}

interface VoiceCache {
  audio: Buffer;
  ts: number;
}

const CAUSA_TTL_MS = 5 * 60_000; // 5 min
const VOICE_TTL_MS = 5 * 60_000; // 5 min

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly causaCache = new Map<string, CausaCache>();
  private readonly voiceCache = new Map<string, VoiceCache>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly ai: AiService,
  ) {}

  async listActive() {
    try {
      const alerts = this.supabase.schema('alerts');
      const { data, error } = await alerts
        .from('active')
        .select('*')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });
      if (error) {
        this.logger.warn(`listActive fail: ${error.message}`);
        return { alerts: [], stale: true };
      }
      return { alerts: data ?? [] };
    } catch (err) {
      this.logger.warn(`listActive exception: ${(err as Error).message}`);
      return { alerts: [], stale: true };
    }
  }

  async listHistory(limit = 100, offset = 0) {
    try {
      const alertsSchema = this.supabase.schema('alerts');
      const { data, error, count } = await alertsSchema
        .from('active')
        .select('id, severity, area, source, title, message, metadata, detected_at, resolved_at', { count: 'exact' })
        .not('resolved_at', 'is', null)
        .order('detected_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        this.logger.warn(`listHistory fail: ${error.message}`);
        return { alerts: [], total: 0, stale: true };
      }
      return { alerts: data ?? [], total: count ?? 0 };
    } catch (err) {
      this.logger.warn(`listHistory exception: ${(err as Error).message}`);
      return { alerts: [], total: 0, stale: true };
    }
  }

  async resumenHistorial(limit: number) {
    try {
      const alertsSchema = this.supabase.schema('alerts');
      const { data, error } = await alertsSchema
        .from('active')
        .select('id, severity, area, title, detected_at, resolved_at, metadata')
        .not('resolved_at', 'is', null)
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.warn(`resumenHistorial fail: ${error.message}`);
        return { resumen: 'Error al obtener historial.', patrones: [], recomendaciones: [], stats: null, stale: true };
      }

      const rows = (data ?? []) as Array<{
        id: string;
        severity: string;
        area: string;
        title: string;
        detected_at: string;
        resolved_at: string;
        metadata: Record<string, unknown>;
      }>;

      // Build aggregated payload
      const byArea: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byTurno: Record<string, number> = {};
      const titleFreq: Record<string, number> = {};
      let totalDurMin = 0;
      let maxDurMin = 0;
      let countWithDur = 0;

      for (const r of rows) {
        // area
        byArea[r.area] = (byArea[r.area] ?? 0) + 1;

        // severity (normalizada)
        const sev = normalizeSeverity(r.severity);
        bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;

        // turno via getCurrentShift helper
        const shift = getCurrentShift(new Date(r.detected_at));
        byTurno[shift.displayName] = (byTurno[shift.displayName] ?? 0) + 1;

        // duration
        if (r.resolved_at) {
          const dur = Math.round((new Date(r.resolved_at).getTime() - new Date(r.detected_at).getTime()) / 60_000);
          if (dur >= 0) {
            totalDurMin += dur;
            if (dur > maxDurMin) maxDurMin = dur;
            countWithDur++;
          }
        }

        // title frequency
        titleFreq[r.title] = (titleFreq[r.title] ?? 0) + 1;
      }

      const avgDurMin = countWithDur > 0 ? Math.round(totalDurMin / countWithDur) : 0;
      const top5Titles = Object.entries(titleFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([title, count]) => ({ title, count }));

      const stats = {
        total: rows.length,
        byArea,
        bySeverity,
        byTurno,
        avgDurationMin: avgDurMin,
        maxDurationMin: maxDurMin,
        top5Sensors: top5Titles,
      };

      if (!this.ai.isAvailable()) {
        return { resumen: 'IA no disponible.', patrones: [], recomendaciones: [], stats };
      }

      const aiResult = await this.ai.resumenHistorial(stats);
      if (!aiResult) {
        return { resumen: 'No se pudo generar el resumen.', patrones: [], recomendaciones: [], stats };
      }

      return { ...aiResult, stats };
    } catch (err) {
      this.logger.warn(`resumenHistorial exception: ${(err as Error).message}`);
      return { resumen: 'Error inesperado.', patrones: [], recomendaciones: [], stats: null, stale: true };
    }
  }

  async getAnalisisCausa(id: string) {
    // Buscar alerta
    const alertsSchema = this.supabase.schema('alerts');
    const { data, error } = await alertsSchema
      .from('active')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (error) throw new Error(`DB fail: ${error.message}`);
    const alert = (data ?? [])[0] as AlertRow | undefined;
    if (!alert) throw new NotFoundException(`Alerta ${id} no encontrada o ya resuelta`);

    const metaKey = `${alert.metadata?.value ?? ''}_${alert.metadata?.updated_at ?? ''}`;

    // Cache hit
    const cached = this.causaCache.get(id);
    if (cached && Date.now() - cached.ts < CAUSA_TTL_MS && cached.metaKey === metaKey) {
      this.logger.debug(`causa cache HIT (id=${id.slice(0, 8)})`);
      return { ...cached.result, cached: true };
    }

    // Cache miss → llamar IA
    if (!this.ai.isAvailable()) {
      return { causa_probable: 'IA no disponible.', factores_contribuyentes: [], acciones_sugeridas: [], cached: false };
    }

    const result = await this.ai.analizarAlertaCausa(alert);
    if (!result) {
      return { causa_probable: 'No se pudo generar análisis.', factores_contribuyentes: [], acciones_sugeridas: [], cached: false };
    }

    this.causaCache.set(id, { result, ts: Date.now(), metaKey });
    return { ...result, cached: false };
  }

  async generarAudioTexto(text: string): Promise<Buffer | null> {
    if (!this.ai.isAvailable()) return null;
    return this.ai.generarVozAlertas(text);
  }

  async generarAudioAlertas(alertIds: string[]): Promise<Buffer | null> {
    if (!alertIds.length) return null;

    // Cache key: sorted ids joined
    const cacheKey = [...alertIds].sort().join(',');
    const cached = this.voiceCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < VOICE_TTL_MS) {
      this.logger.debug(`voice cache HIT (${alertIds.length} alerts)`);
      return cached.audio;
    }

    // Buscar alertas activas
    const alertsSchema = this.supabase.schema('alerts');
    const { data, error } = await alertsSchema
      .from('active')
      .select('id, severity, area, title, metadata')
      .in('id', alertIds)
      .is('resolved_at', null);

    if (error || !data?.length) {
      this.logger.warn(`generarAudioAlertas: no se encontraron alertas (${error?.message ?? 'empty'})`);
      return null;
    }

    // Ordenar critical → warn → info
    const sorted = [...data].sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity));

    const critCount = sorted.filter((a) => normalizeSeverity(a.severity) === 'critical').length;
    const warnCount = sorted.filter((a) => normalizeSeverity(a.severity) === 'warn').length;
    const capArea = (a: string) => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();

    // Encabezado natural — números como palabras para evitar pronunciación en inglés
    const parts: string[] = [];
    if (critCount > 0) parts.push(`${numEs(critCount)} alerta${critCount > 1 ? 's' : ''} crítica${critCount > 1 ? 's' : ''}`);
    if (warnCount > 0) parts.push(`${numEs(warnCount)} advertencia${warnCount > 1 ? 's' : ''}`);
    const resto = sorted.length - critCount - warnCount;
    if (resto > 0) parts.push(`${numEs(resto)} aviso${resto > 1 ? 's' : ''}`);

    // Apertura diferenciada por severidad dominante
    const dominant = sorted.reduce<'info' | 'warn' | 'critical'>((best, a) => {
      const sev = normalizeSeverity(a.severity);
      return sevOrder(sev) < sevOrder(best) ? sev : best;
    }, 'info');
    const opening =
      dominant === 'critical' ? '¡Alarma crítica! ' :
      dominant === 'warn'     ? 'Atención. '        :
                                'Aviso del sistema. ';

    let text = `${opening}Hay ${parts.join(' y ')} en el sistema.`;

    // Agrupar por triage.grupo (si existe) o por área
    type AlertRow = (typeof sorted)[number];
    const groupMap = new Map<string, AlertRow[]>();
    for (const a of sorted) {
      const t = (a.metadata as { triage?: { grupo?: string } } | null)?.triage;
      const key = t?.grupo ?? a.area;
      const existing = groupMap.get(key);
      if (existing) existing.push(a);
      else groupMap.set(key, [a]);
    }

    const hasGrouped = [...groupMap.values()].some((g) => g.length > 1);

    if (hasGrouped) {
      // Ordenar grupos: el de menor sevOrder (más crítico) primero
      const groupsSorted = [...groupMap.entries()].sort(([, ga], [, gb]) => {
        const minSev = (arr: AlertRow[]) => Math.min(...arr.map((a) => sevOrder(a.severity)));
        return minSev(ga) - minSev(gb);
      });

      const toSpeak = groupsSorted.slice(0, 3);
      const totalSpoken = toSpeak.reduce((acc, [, g]) => acc + g.length, 0);

      for (const [grupo, miembros] of toSpeak) {
        const first = miembros[0];
        const t = (first.metadata as { triage?: { grupo?: string; titular?: string } } | null)?.triage;
        const titulo = t?.titular ?? first.title;
        const meta = (first.metadata ?? {}) as { value?: number; min_value?: number; max_value?: number; unit?: string };
        const uStr = meta.unit ? ` ${unitEs(meta.unit)}` : '';

        if (miembros.length > 1) {
          text += ` En ${capArea(grupo)} hay ${numEs(miembros.length)} alertas relacionadas: ${titulo}.`;
        } else {
          text += ` En ${capArea(grupo)}, alerta ${sevLabel(first.severity)}: ${titulo}.`;
        }

        if (meta.value != null) {
          text += ` El valor actual es ${numEs(meta.value)}${uStr}.`;
          if (meta.max_value != null && meta.value > meta.max_value) {
            text += ` Está por encima del máximo permitido de ${numEs(meta.max_value)}${uStr}.`;
          } else if (meta.min_value != null && meta.value < meta.min_value) {
            text += ` Está por debajo del mínimo permitido de ${numEs(meta.min_value)}${uStr}.`;
          }
        }

        const recom = (first.metadata as { triage?: { recomendacion?: string } })?.triage?.recomendacion;
        if (recom) {
          const sevFirst = normalizeSeverity(first.severity);
          text += sevFirst === 'critical' ? ` Acción inmediata: ${recom}.` : ` Se recomienda: ${recom}.`;
        }
      }

      if (sorted.length > totalSpoken) {
        const extra = sorted.length - totalSpoken;
        text += ` Además hay ${numEs(extra)} alerta${extra > 1 ? 's' : ''} más pendiente${extra > 1 ? 's' : ''}.`;
      }
    } else {
      // Sin grupos: path original, alerta por alerta
      const toSpeak = sorted.slice(0, 3);
      for (const a of toSpeak) {
        const meta = (a.metadata ?? {}) as { value?: number; min_value?: number; max_value?: number; unit?: string };
        const uStr = meta.unit ? ` ${unitEs(meta.unit)}` : '';
        text += ` En el área de ${capArea(a.area)}, alerta ${sevLabel(a.severity)}: ${a.title}.`;
        if (meta.value != null) {
          text += ` El valor actual es ${numEs(meta.value)}${uStr}.`;
          if (meta.max_value != null && meta.value > meta.max_value) {
            text += ` Está por encima del máximo permitido de ${numEs(meta.max_value)}${uStr}.`;
          } else if (meta.min_value != null && meta.value < meta.min_value) {
            text += ` Está por debajo del mínimo permitido de ${numEs(meta.min_value)}${uStr}.`;
          }
        }
        const recomSingle = (a.metadata as { triage?: { recomendacion?: string } })?.triage?.recomendacion;
        if (recomSingle) {
          const sevA = normalizeSeverity(a.severity);
          text += sevA === 'critical' ? ` Acción inmediata: ${recomSingle}.` : ` Se recomienda: ${recomSingle}.`;
        }
      }
      if (sorted.length > 3) {
        const extra = sorted.length - 3;
        text += ` Además hay ${numEs(extra)} alerta${extra > 1 ? 's' : ''} más pendiente${extra > 1 ? 's' : ''}.`;
      }
    }

    if (!this.ai.isAvailable()) return null;

    const audio = await this.ai.generarVozAlertas(text);
    if (!audio) return null;

    this.voiceCache.set(cacheKey, { audio, ts: Date.now() });
    this.logger.log(`TTS generado y cacheado (${alertIds.length} alertas, ${text.length} chars)`);
    return audio;
  }
}
