import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SENSOR_CATALOG, resolveStatus } from '../../config/sensor-catalog';
import type { MetricsWebhookPayload } from './dto/metrics-webhook.dto';
import type { MillSpeedWebhookPayload } from './dto/mill-speed-webhook.dto';

interface EnrichedMetric {
  sensor_id: string;
  value: number;
  status: 'ok' | 'warn' | 'alarm' | 'unknown';
  updated_at: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async ingestMetrics(area: 'energia' | 'produccion', payload: MetricsWebhookPayload) {
    const ts = payload.timestamp ?? new Date().toISOString();
    const enriched: EnrichedMetric[] = [];

    for (const m of payload.metrics) {
      const def = SENSOR_CATALOG[m.sensor_id];
      if (!def) {
        this.logger.warn(`Unknown sensor_id "${m.sensor_id}" — skipped`);
        continue;
      }
      if (def.area !== area) {
        this.logger.warn(`Sensor "${m.sensor_id}" belongs to "${def.area}", not "${area}"`);
        continue;
      }
      const value = typeof m.value === 'number' ? m.value : parseFloat(String(m.value));
      if (Number.isNaN(value)) continue;
      const status = resolveStatus(value, def.setpoints);
      enriched.push({ sensor_id: m.sensor_id, value, status, updated_at: ts });
    }

    // Derived calculations
    if (area === 'energia') {
      const c2 = enriched.find((e) => e.sensor_id === 'caudal_caldera_2')?.value;
      const c3 = enriched.find((e) => e.sensor_id === 'caudal_caldera_3')?.value;
      const c6 = enriched.find((e) => e.sensor_id === 'caudal_caldera_6')?.value;
      if (c2 != null && c3 != null && c6 != null) {
        const total = c2 + c3 + c6;
        enriched.push({
          sensor_id: 'caudal_total_vapor',
          value: total,
          status: resolveStatus(total, SENSOR_CATALOG.caudal_total_vapor.setpoints),
          updated_at: ts,
        });
      }
      const weg = enriched.find((e) => e.sensor_id === 'potencia_weg')?.value;
      const siemens = enriched.find((e) => e.sensor_id === 'potencia_siemens')?.value;
      if (weg != null && siemens != null) {
        const total = weg + siemens;
        enriched.push({
          sensor_id: 'generacion_total',
          value: total,
          status: resolveStatus(total, SENSOR_CATALOG.generacion_total.setpoints),
          updated_at: ts,
        });
      }
    }

    if (enriched.length === 0) {
      this.logger.warn(`No valid metrics for ${area} in payload`);
      return { ingested: 0, timestamp: ts };
    }

    const industrial = this.supabase.schema('industrial');

    // Upsert metrics_live
    const { error: upsertErr } = await industrial
      .from('metrics_live')
      .upsert(enriched, { onConflict: 'sensor_id' });

    if (upsertErr) {
      this.logger.error('Upsert metrics_live failed', upsertErr);
      throw new Error(upsertErr.message);
    }

    // Append history (fire-and-forget — no bloquear webhook)
    industrial
      .from('metrics_history')
      .insert(enriched.map((e) => ({ ...e, recorded_at: ts })))
      .then(({ error }) => {
        if (error) this.logger.warn('history insert failed: ' + error.message);
      });

    this.logger.log(`Ingested ${enriched.length} ${area} metrics @ ${ts}`);
    return { ingested: enriched.length, timestamp: ts };
  }

  async ingestMillSpeed(payload: MillSpeedWebhookPayload) {
    const industrial = this.supabase.schema('industrial');
    const { error } = await industrial
      .from('shift_kpis_cache')
      .upsert(
        [
          {
            kpi_id: 'vel_primer_molino',
            shift_date: payload.shift_date,
            shift_name: payload.shift,
            shift_ref: 'previous',
            payload: {
              promedio_rpm: payload.promedio_rpm,
              samples: payload.samples,
            },
            fetched_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'kpi_id,shift_date,shift_name,tenant_id,plant_id' },
      );
    if (error) {
      this.logger.error('Mill speed upsert failed', error);
      throw new Error(error.message);
    }
    this.logger.log(`Mill speed cached for ${payload.shift_date} ${payload.shift}`);
    return { ok: true };
  }
}
