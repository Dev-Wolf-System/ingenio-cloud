import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

interface Threshold {
  id: string;
  area: 'energia' | 'produccion' | 'trapiche';
  key: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
  severity: 'info' | 'warn' | 'critical';
  notes: string | null;
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
}

@Injectable()
export class ThresholdEvaluatorService {
  private readonly logger = new Logger(ThresholdEvaluatorService.name);

  constructor(private readonly supabase: SupabaseService) {}

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
      .select('id, area, key, min_value, max_value, enabled, severity, notes')
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
      .select('id, source')
      .is('resolved_at', null);
    if (oErr) {
      this.logger.warn(`open alerts load failed: ${oErr.message}`);
      return;
    }
    const openMap = new Map<string, string>();
    (openAlerts ?? []).forEach((r) => {
      const row = r as OpenAlertRow;
      openMap.set(row.source, row.id);
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

    for (const rule of rules) {
      const source = `threshold::${rule.area}::${rule.key}`;
      const row = valueMap.get(`${rule.area}::${rule.key}`);
      if (!row) continue; // sin lectura, no evaluamos

      const tooLow = rule.min_value != null && row.value < rule.min_value;
      const tooHigh = rule.max_value != null && row.value > rule.max_value;
      const isOut = tooLow || tooHigh;
      const openId = openMap.get(source);

      if (isOut && !openId) {
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
      } else if (!isOut && openId) {
        toResolve.push(openId);
      }
    }

    // 5. Insertar nuevas alertas
    if (toOpen.length > 0) {
      const { error } = await alerts.from('active').insert(toOpen);
      if (error) this.logger.warn(`alert open insert failed: ${error.message}`);
      else this.logger.log(`opened ${toOpen.length} alerts`);
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
  }
}
