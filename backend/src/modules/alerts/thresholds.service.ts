import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type ThresholdSeverity = 'info' | 'warn' | 'critical';
export type ThresholdArea = 'energia' | 'produccion' | 'trapiche';

export interface ThresholdRow {
  id?: string;
  area: ThresholdArea;
  key: string;
  min_value: number | null;
  max_value: number | null;
  enabled: boolean;
  severity: ThresholdSeverity;
  notes?: string | null;
}

@Injectable()
export class ThresholdsService {
  private readonly logger = new Logger(ThresholdsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async list(area?: ThresholdArea) {
    try {
      const industrial = this.supabase.schema('industrial');
      let q = industrial.from('alert_thresholds').select('*');
      if (area) q = q.eq('area', area);
      const { data, error } = await q.order('area').order('key');
      if (error) {
        this.logger.warn(`thresholds list fail: ${error.message}`);
        return { thresholds: [], stale: true };
      }
      return { thresholds: data ?? [] };
    } catch (err) {
      this.logger.warn(`thresholds list exception: ${(err as Error).message}`);
      return { thresholds: [], stale: true };
    }
  }

  async upsertMany(rows: ThresholdRow[]) {
    if (!rows?.length) return { upserted: 0 };
    try {
      const industrial = this.supabase.schema('industrial');
      const payload = rows.map((r) => ({
        area: r.area,
        key: r.key,
        min_value: r.min_value,
        max_value: r.max_value,
        enabled: r.enabled,
        severity: r.severity,
        notes: r.notes ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await industrial
        .from('alert_thresholds')
        .upsert(payload, { onConflict: 'area,key,tenant_id,plant_id' });
      if (error) throw new Error(error.message);
      return { upserted: payload.length };
    } catch (err) {
      this.logger.warn(`thresholds upsert exception: ${(err as Error).message}`);
      throw err;
    }
  }

  async remove(id: string) {
    try {
      const industrial = this.supabase.schema('industrial');
      const { error } = await industrial.from('alert_thresholds').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err) {
      this.logger.warn(`thresholds remove exception: ${(err as Error).message}`);
      throw err;
    }
  }
}
