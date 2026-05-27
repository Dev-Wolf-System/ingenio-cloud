import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';

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

    // Ordenar critical → warning → info
    const ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const sorted = [...data].sort(
      (a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9),
    );

    const sevLabel = (s: string) =>
      s === 'critical' ? 'Crítica' : s === 'warning' ? 'Advertencia' : 'Aviso';

    const critCount = sorted.filter((a) => a.severity === 'critical').length;
    const capArea = (a: string) => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase();

    let text = 'Sistema de monitoreo industrial. Atención';
    if (critCount === 1) text += ', una alerta crítica';
    else if (critCount > 1) text += `, ${critCount} alertas críticas`;
    text += '.';

    const toSpeak = sorted.slice(0, 3);
    for (const a of toSpeak) {
      const meta = (a.metadata ?? {}) as { value?: number; min_value?: number; max_value?: number; unit?: string };
      text += ` ${sevLabel(a.severity)} en ${capArea(a.area)}, ${a.title}.`;
      if (meta.value != null) {
        text += ` Valor actual ${meta.value}${meta.unit ? ' ' + meta.unit : ''}.`;
        if (meta.max_value != null && meta.value > meta.max_value) {
          text += ` Máximo permitido ${meta.max_value}.`;
        } else if (meta.min_value != null && meta.value < meta.min_value) {
          text += ` Mínimo permitido ${meta.min_value}.`;
        }
      }
    }
    if (sorted.length > 3) {
      text += ` Y ${sorted.length - 3} alerta${sorted.length - 3 === 1 ? '' : 's'} más.`;
    }

    if (!this.ai.isAvailable()) return null;

    const audio = await this.ai.generarVozAlertas(text);
    if (!audio) return null;

    this.voiceCache.set(cacheKey, { audio, ts: Date.now() });
    this.logger.log(`TTS generado y cacheado (${alertIds.length} alertas, ${text.length} chars)`);
    return audio;
  }
}
