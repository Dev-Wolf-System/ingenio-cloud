import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async snapshot(area?: 'energia' | 'produccion' | 'trapiche') {
    try {
      const industrial = this.supabase.schema('industrial');
      let q = industrial
        .from('metrics_live')
        .select('sensor_id, value, status, updated_at, sensor_mapping:sensor_id(label, area, unit, category)');
      if (area) q = q.eq('sensor_mapping.area', area);
      const { data, error } = await q;
      if (error) {
        this.logger.warn(`snapshot fail: ${error.message}`);
        return { metrics: [], stale: true };
      }
      return { metrics: data ?? [] };
    } catch (err) {
      this.logger.warn(`snapshot exception: ${(err as Error).message}`);
      return { metrics: [], stale: true };
    }
  }

  async dashboardSnapshot(area?: 'energia' | 'produccion' | 'trapiche') {
    try {
      const industrial = this.supabase.schema('industrial');
      let q = industrial
        .from('dashboard_data')
        .select('area, key, value, display, unit, raw, updated_at');
      if (area) q = q.eq('area', area);
      const { data, error } = await q;
      if (error) {
        this.logger.warn(`dashboard-snapshot ${area ?? 'all'} fail: ${error.message}`);
        return { data: [], stale: true };
      }
      return { data: data ?? [] };
    } catch (err) {
      this.logger.warn(`dashboard-snapshot exception: ${(err as Error).message}`);
      return { data: [], stale: true };
    }
  }

  async canchonResumen() {
    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_canchon_resumen')
        .select('total_camiones')
        .maybeSingle();
      if (error) {
        this.logger.warn(`canchon fail: ${error.message}`);
        return { total_camiones: null, stale: true };
      }
      return { total_camiones: (data as { total_camiones?: number } | null)?.total_camiones ?? 0 };
    } catch (err) {
      this.logger.warn(`canchon exception: ${(err as Error).message}`);
      return { total_camiones: null, stale: true };
    }
  }

  async catalog() {
    try {
      const industrial = this.supabase.schema('industrial');
      const { data, error } = await industrial
        .from('sensor_mapping')
        .select('*')
        .eq('active', true)
        .order('area')
        .order('category');
      if (error) {
        this.logger.warn(`catalog fail: ${error.message}`);
        return { sensors: [], stale: true };
      }
      return { sensors: data ?? [] };
    } catch (err) {
      this.logger.warn(`catalog exception: ${(err as Error).message}`);
      return { sensors: [], stale: true };
    }
  }
}
