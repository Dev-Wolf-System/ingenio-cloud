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

  async bolsasDia() {
    try {
      const production = this.supabase.schema('production');

      // Fecha industrial actual: día ART si hora >= 07:00 ART, si no el día anterior.
      const nowUtc = new Date();
      const artHour = (nowUtc.getUTCHours() - 3 + 24) % 24;
      const diaBase = new Date(nowUtc);
      diaBase.setUTCHours(0, 0, 0, 0);
      if (artHour < 7) diaBase.setUTCDate(diaBase.getUTCDate() - 1);
      // fecha_industrial en la vista es medianoche UTC del día calendario ART (= 03:00 UTC)
      const diaIndustrialIso = new Date(diaBase.getTime() + 3 * 60 * 60 * 1000).toISOString();

      const { data, error } = await production
        .from('v_bolsas_dia')
        .select('fecha_industrial, total_bolsas, horas_cargadas, ultima_hora')
        .eq('fecha_industrial', diaIndustrialIso)
        .maybeSingle();
      if (error) {
        this.logger.warn(`bolsas-dia fail: ${error.message}`);
        return { stale: true, total_bolsas: null, horas_cargadas: null, ultima_hora: null, fecha_industrial: null };
      }
      const row = data as {
        fecha_industrial?: string | null;
        total_bolsas?: number | string | null;
        horas_cargadas?: number | string | null;
        ultima_hora?: string | null;
      } | null;
      const toNum = (v: number | string | null | undefined): number | null => {
        if (v == null) return null;
        const n = typeof v === 'string' ? parseFloat(v) : v;
        return Number.isFinite(n) ? n : null;
      };
      // Sin datos hoy → 0 bolsas (no mostrar dato de ayer)
      if (!row) {
        return { fecha_industrial: diaIndustrialIso, total_bolsas: 0, horas_cargadas: 0, ultima_hora: null };
      }
      return {
        fecha_industrial: row.fecha_industrial ?? null,
        total_bolsas: toNum(row.total_bolsas),
        horas_cargadas: toNum(row.horas_cargadas),
        ultima_hora: row.ultima_hora ?? null,
      };
    } catch (err) {
      this.logger.warn(`bolsas-dia exception: ${(err as Error).message}`);
      return { stale: true, total_bolsas: null, horas_cargadas: null, ultima_hora: null, fecha_industrial: null };
    }
  }

  async colorCintaLarga() {
    try {
      const pub = this.supabase.schema('public');
      const { data, error } = await pub
        .from('v_color_cinta_larga')
        .select('color_icumsa, humedad, hora_lectura')
        .maybeSingle();
      if (error) {
        this.logger.warn(`color-cinta-larga fail: ${error.message}`);
        return { color_icumsa: null, humedad: null, hora_lectura: null, stale: true };
      }
      const row = data as { color_icumsa?: number; humedad?: number; hora_lectura?: string } | null;
      return {
        color_icumsa: row?.color_icumsa ?? null,
        humedad: row?.humedad ?? null,
        hora_lectura: row?.hora_lectura ?? null,
      };
    } catch (err) {
      this.logger.warn(`color-cinta-larga exception: ${(err as Error).message}`);
      return { color_icumsa: null, humedad: null, hora_lectura: null, stale: true };
    }
  }

  async trapicheBagazo() {
    try {
      const production = this.supabase.schema('production');
      const { data, error } = await production
        .from('v_trapiche_bagazo_ultimo')
        .select(
          'pol_bagazo, pol_bagazo_hora, humedad_bagazo, humedad_bagazo_hora, fibra_bagazo, fibra_bagazo_hora, ' +
            'pol_cachaza, pol_cachaza_hora, humedad_cachaza, humedad_cachaza_hora',
        )
        .maybeSingle();
      if (error) {
        this.logger.warn(`trapiche-bagazo fail: ${error.message}`);
        return { stale: true };
      }
      const row = data as {
        pol_bagazo?: number | null;
        pol_bagazo_hora?: string | null;
        humedad_bagazo?: number | null;
        humedad_bagazo_hora?: string | null;
        fibra_bagazo?: number | null;
        fibra_bagazo_hora?: string | null;
        pol_cachaza?: number | null;
        pol_cachaza_hora?: string | null;
        humedad_cachaza?: number | null;
        humedad_cachaza_hora?: string | null;
      } | null;
      return {
        pol_bagazo: row?.pol_bagazo ?? null,
        pol_bagazo_hora: row?.pol_bagazo_hora ?? null,
        humedad_bagazo: row?.humedad_bagazo ?? null,
        humedad_bagazo_hora: row?.humedad_bagazo_hora ?? null,
        fibra_bagazo: row?.fibra_bagazo ?? null,
        fibra_bagazo_hora: row?.fibra_bagazo_hora ?? null,
        pol_cachaza: row?.pol_cachaza ?? null,
        pol_cachaza_hora: row?.pol_cachaza_hora ?? null,
        humedad_cachaza: row?.humedad_cachaza ?? null,
        humedad_cachaza_hora: row?.humedad_cachaza_hora ?? null,
      };
    } catch (err) {
      this.logger.warn(`trapiche-bagazo exception: ${(err as Error).message}`);
      return { stale: true };
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
