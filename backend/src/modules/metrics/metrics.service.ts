import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MetricsService {
  constructor(private readonly supabase: SupabaseService) {}

  async snapshot(area?: 'energia' | 'produccion') {
    const industrial = this.supabase.schema('industrial');
    let q = industrial
      .from('metrics_live')
      .select('sensor_id, value, status, updated_at, sensor_mapping:sensor_id(label, area, unit, category)');
    if (area) {
      q = q.eq('sensor_mapping.area', area);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { metrics: data ?? [] };
  }

  async dashboardSnapshot(area?: 'energia' | 'produccion') {
    const industrial = this.supabase.schema('industrial');
    let q = industrial
      .from('dashboard_data')
      .select('area, key, value, display, unit, raw, updated_at');
    if (area) q = q.eq('area', area);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { data: data ?? [] };
  }

  async catalog() {
    const industrial = this.supabase.schema('industrial');
    const { data, error } = await industrial
      .from('sensor_mapping')
      .select('*')
      .eq('active', true)
      .order('area')
      .order('category');
    if (error) throw new Error(error.message);
    return { sensors: data ?? [] };
  }
}
