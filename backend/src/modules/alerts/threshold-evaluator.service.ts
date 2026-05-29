import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { shouldEscalate } from './escalation';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeSeverity } from './severity';

interface Threshold {
  id: string;
  area: 'energia' | 'produccion' | 'trapiche';
  key: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
  severity: 'info' | 'warn' | 'critical';
  notes: string | null;
  escalate_after_min: number | null;
  escalate_drift_pct: number | null;
}

interface DashboardRow {
  area: string;
  key: string;
  value: number;
  unit: string | null;
  updated_at: string;
}

interface OpenAlertRow {
  id: string;
  source: string;
  severity: string;
  detected_at: string;
  metadata: Record<string, unknown> & { normal_since?: string };
}

@Injectable()
export class ThresholdEvaluatorService {
  private readonly logger = new Logger(ThresholdEvaluatorService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notif: NotificationsService,
  ) {}

  /** Tiempo mínimo en rango antes de resolver (debounce de normalización): 30 s. */
  private static readonly NORMALIZE_AFTER_MS = 30_000;

  /** Cron cada 30s — evalúa thresholds vs dashboard_data y maneja alerts.active */
  @Cron(CronExpression.EVERY_30_SECONDS, {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async evaluate(): Promise<void> {
    const industrial = this.supabase.schema('industrial');
    const alerts = this.supabase.schema('alerts');

    // 1. Cargar thresholds activos
    const { data: thresholds, error: tErr } = await industrial
      .from('alert_thresholds')
      .select('id, area, key, min_value, max_value, enabled, severity, notes, escalate_after_min, escalate_drift_pct')
      .eq('enabled', true);
    if (tErr) {
      this.logger.warn(`thresholds load failed: ${tErr.message}`);
      return;
    }
    const rules = (thresholds ?? []) as Threshold[];
    if (rules.length === 0) return;

    // 2. Cargar snapshot dashboard
    const { data: snapshot, error: dErr } = await industrial
      .from('dashboard_data')
      .select('area, key, value, unit, updated_at');
    if (dErr) {
      this.logger.warn(`snapshot load failed: ${dErr.message}`);
      return;
    }
    const valueMap = new Map<string, DashboardRow>();
    (snapshot ?? []).forEach((r) => {
      const row = r as DashboardRow;
      valueMap.set(`${row.area}::${row.key}`, row);
    });

    // 3. Cargar alertas abiertas (resolved_at IS NULL)
    const { data: openAlerts, error: oErr } = await alerts
      .from('active')
      .select('id, source, severity, detected_at, metadata')
      .is('resolved_at', null);
    if (oErr) {
      this.logger.warn(`open alerts load failed: ${oErr.message}`);
      return;
    }
    const openMap = new Map<string, OpenAlertRow>();
    (openAlerts ?? []).forEach((r) => {
      const row = r as OpenAlertRow;
      openMap.set(row.source, row);
    });

    // 4. Evaluar
    const toOpen: Array<{
      severity: string;
      area: string;
      source: string;
      title: string;
      message: string;
      metadata: Record<string, unknown>;
    }> = [];
    const toResolve: string[] = [];
    const toEscalate: Array<{ id: string; reason: string; metadata: Record<string, unknown>; severity: string }> = [];
    /** Alertas que entraron en rango por primera vez: marcar normal_since = now */
    const toMarkNormal: Array<{ id: string; metadata: Record<string, unknown>; since: string }> = [];
    /** Alertas que salieron de rango mientras ya tenían normal_since: borrar ese campo */
    const toClearNormalSince: Array<{ id: string; metadata: Record<string, unknown> }> = [];

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    for (const rule of rules) {
      const source = `threshold::${rule.area}::${rule.key}`;
      const row = valueMap.get(`${rule.area}::${rule.key}`);
      if (!row) continue; // sin lectura, no evaluamos

      const tooLow = rule.min_value != null && row.value < rule.min_value;
      const tooHigh = rule.max_value != null && row.value > rule.max_value;
      const isOut = tooLow || tooHigh;
      const open = openMap.get(source);
      const openId = open?.id;

      if (isOut && !openId) {
        // Nueva alerta: abrir
        toOpen.push({
          severity: rule.severity,
          area: rule.area,
          source,
          title: `${rule.key.replaceAll('_', ' ')} fuera de rango`,
          message:
            (tooLow
              ? `Valor ${row.value}${row.unit ?? ''} < mínimo ${rule.min_value}`
              : `Valor ${row.value}${row.unit ?? ''} > máximo ${rule.max_value}`) +
            (rule.notes ? ` · ${rule.notes}` : ''),
          metadata: {
            threshold_id: rule.id,
            value: row.value,
            unit: row.unit,
            min_value: rule.min_value,
            max_value: rule.max_value,
            updated_at: row.updated_at,
          },
        });
      } else if (!isOut && open) {
        // Valor volvió al rango — debounce: resolver solo tras ≥ NORMALIZE_AFTER_MS continuo en rango
        const normalSince = open.metadata?.normal_since;
        if (!normalSince) {
          // Primera vez en rango: marcar timestamp, no resolver aún
          toMarkNormal.push({ id: open.id, metadata: open.metadata ?? {}, since: nowIso });
        } else if (nowMs - new Date(normalSince).getTime() >= ThresholdEvaluatorService.NORMALIZE_AFTER_MS) {
          // Suficiente tiempo en rango → resolver (el frontend anunciará normalización)
          toResolve.push(open.id);
        }
        // else: sigue en cooldown, esperar siguiente tick
      } else if (isOut && open && open.severity !== 'critical') {
        // Valor sigue/volvió a salir de rango
        if (open.metadata?.normal_since) {
          // Salió durante el cooldown: limpiar normal_since
          toClearNormalSince.push({ id: open.id, metadata: open.metadata ?? {} });
        }
        // Escalación normal — al construir metadata de escalación se omite normal_since
        // para no cargar un valor obsoleto hacia el update de escalación
        const res = shouldEscalate({
          severity: open.severity,
          detectedAt: open.detected_at,
          value: row.value,
          min: rule.min_value,
          max: rule.max_value,
          afterMin: rule.escalate_after_min ?? null,
          driftPct: rule.escalate_drift_pct ?? null,
        });
        if (res.escalate) {
          // Spread metadata sin normal_since para evitar conflicto con toClearNormalSince
          const { normal_since: _ns, ...metaWithoutNormalSince } = open.metadata ?? {};
          toEscalate.push({
            id: open.id,
            reason: res.reason,
            metadata: metaWithoutNormalSince,
            severity: open.severity,
          });
        }
      }
    }

    // 5. Insertar nuevas alertas
    if (toOpen.length > 0) {
      const { error } = await alerts.from('active').insert(toOpen);
      if (error) this.logger.warn(`alert open insert failed: ${error.message}`);
      else {
        this.logger.log(`opened ${toOpen.length} alerts`);
        for (const a of toOpen) {
          const sevN = normalizeSeverity(a.severity);
          const bodySuffix =
            sevN === 'critical' ? ' · acción inmediata requerida' :
            sevN === 'warn'     ? ' · revisar'                    :
                                  ' · informativo';
          await this.notif.notify(a.source, {
            title: `${sevN === 'critical' ? '🔴' : sevN === 'warn' ? '🟠' : '🔵'} ${a.area}`,
            body: `${a.title}${bodySuffix}`,
            severity: a.severity,
            url: '/alertas',
          });
        }
      }
    }

    // 6. Resolver alertas vueltas a rango
    if (toResolve.length > 0) {
      const { error } = await alerts
        .from('active')
        .update({ resolved_at: new Date().toISOString() })
        .in('id', toResolve);
      if (error) this.logger.warn(`alert resolve failed: ${error.message}`);
      else this.logger.log(`resolved ${toResolve.length} alerts`);
    }

    // 7. Escalar alertas persistentes o con drift elevado
    for (const e of toEscalate) {
      const { error } = await alerts
        .from('active')
        .update({
          severity: 'critical',
          metadata: {
            ...e.metadata,
            escalated: true,
            escalated_at: new Date().toISOString(),
            escalated_reason: e.reason,
            original_severity: e.severity,
          },
        })
        .eq('id', e.id);
      if (error) this.logger.warn(`alert escalate failed (${e.id}): ${error.message}`);
      else {
        await this.notif.notify(`${e.id}::escalated`, {
          title: `🔴 Escalada a crítica`,
          body: `Escaló a crítica (${e.reason}) · acción inmediata`,
          severity: 'critical',
          url: '/alertas',
        });
      }
    }
    if (toEscalate.length > 0) this.logger.log(`escalated ${toEscalate.length} alerts`);

    // 8. Marcar normal_since en alertas que acaban de entrar en rango (debounce)
    for (const m of toMarkNormal) {
      const { error } = await alerts
        .from('active')
        .update({ metadata: { ...m.metadata, normal_since: m.since } })
        .eq('id', m.id);
      if (error) this.logger.warn(`mark normal_since failed (${m.id}): ${error.message}`);
    }
    if (toMarkNormal.length > 0) this.logger.log(`marked normal_since on ${toMarkNormal.length} alerts`);

    // 9. Limpiar normal_since en alertas que salieron de rango durante el cooldown
    // Saltear ids que ya fueron procesados en el paso 7 (escalación escribe metadata sin normal_since)
    const escalatedIds = new Set(toEscalate.map((e) => e.id));
    for (const m of toClearNormalSince) {
      if (escalatedIds.has(m.id)) continue; // ya cubierto por el update de escalación (que omite normal_since)
      const { normal_since: _ns, ...rest } = m.metadata ?? {};
      const { error } = await alerts
        .from('active')
        .update({ metadata: rest })
        .eq('id', m.id);
      if (error) this.logger.warn(`clear normal_since failed (${m.id}): ${error.message}`);
    }
    if (toClearNormalSince.length > 0) this.logger.log(`cleared normal_since on ${toClearNormalSince.length} alerts`);
  }
}
