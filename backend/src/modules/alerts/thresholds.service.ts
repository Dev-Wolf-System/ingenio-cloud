import { Injectable } from '@nestjs/common';
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
  constructor(private readonly supabase: SupabaseService) {}

  async list(area?: ThresholdArea) {
    const industrial = this.supabase.schema('industrial');
    let q = industrial.from('alert_thresholds').select('*');
    if (area) q = q.eq('area', area);
    const { data, error } = await q.order('area').order('key');
    if (error) throw new Error(error.message);
    return { thresholds: data ?? [] };
  }

  async upsertMany(rows: ThresholdRow[]) {
    if (!rows?.length) return { upserted: 0 };
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
  }

  async remove(id: string) {
    const industrial = this.supabase.schema('industrial');
    const { error } = await industrial.from('alert_thresholds').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
}
