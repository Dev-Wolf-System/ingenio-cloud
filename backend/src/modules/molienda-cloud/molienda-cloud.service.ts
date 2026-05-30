import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { agregarCana, type CanaRow } from './comparativa';

@Injectable()
export class MoliendaCloudService {
  private readonly logger = new Logger(MoliendaCloudService.name);
  constructor(private readonly supabase: SupabaseService) {}

  async canchon() {
    const { data, error } = await this.supabase.schema('production').from('v_canchon_resumen').select('*');
    if (error) { this.logger.warn(`canchon: ${error.message}`); return { stale: true, data: null }; }
    return { data: (data ?? [])[0] ?? null };
  }

  async balanzaHora() {
    const { data, error } = await this.supabase.schema('production').from('v_descarga_balanza_hora').select('*');
    if (error) { this.logger.warn(`balanzaHora: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async movimientosTipo() {
    const { data, error } = await this.supabase.schema('legacy').from('movimientos')
      .select('tipo_pesada, peso_neto, neto_cana, salida_at')
      .gte('salida_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if (error) { this.logger.warn(`movimientosTipo: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async moliendaBloques() {
    const { data, error } = await this.supabase.schema('production').from('v_molienda_bloques').select('*');
    if (error) { this.logger.warn(`moliendaBloques: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async comparativaCana() {
    const { data, error } = await this.supabase.schema('legacy').from('muestras_lab')
      .select('peso_bruto, neto_cana, trash, pol, brix, pureza, rendimiento, fecha_industrial, nrocierre')
      .order('fecha_industrial', { ascending: false })
      .limit(5000);
    if (error) { this.logger.warn(`comparativaCana: ${error.message}`); return { stale: true, actual: null, ult_cierre: null, acumulado: null }; }

    const rows = (data ?? []) as Array<CanaRow & { fecha_industrial: string | null; nrocierre: number | null }>;
    if (!rows.length) return { actual: null, ult_cierre: null, acumulado: null };

    const maxFecha = rows.reduce((m, r) => (r.fecha_industrial && r.fecha_industrial > m ? r.fecha_industrial : m), '');
    const maxCierre = rows.reduce((m, r) => (r.nrocierre != null && r.nrocierre > m ? r.nrocierre : m), 0);

    const actual = agregarCana(rows.filter((r) => r.fecha_industrial === maxFecha));
    const ult_cierre = agregarCana(rows.filter((r) => r.nrocierre === maxCierre));
    const acumulado = agregarCana(rows);

    return { actual, ult_cierre, acumulado };
  }

  async movimientosCana(limit = 100) {
    const { data, error } = await this.supabase.schema('legacy').from('muestras_lab')
      .select('numero_pesada, grupo, razon_social, numero_analisis, peso_bruto, trash, brix, pol, neto_cana, variedad, salida_at')
      .order('numero_pesada', { ascending: false })
      .limit(limit);
    if (error) { this.logger.warn(`movimientosCana: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async azucar(desde?: string, hasta?: string) {
    // Primero obtenemos la max fecha_industrial del día
    const { data: fechaData, error: fechaError } = await this.supabase.schema('legacy').from('especiales')
      .select('fecha_industrial')
      .order('fecha_industrial', { ascending: false })
      .limit(1);
    if (fechaError) { this.logger.warn(`azucar (fecha): ${fechaError.message}`); return { stale: true, data: [] }; }

    const maxFecha = (fechaData ?? [])[0]?.fecha_industrial ?? null;
    if (!maxFecha) return { data: [] };

    let q = this.supabase.schema('legacy').from('especiales')
      .select('proceso_codigo, fecha_industrial, hora_lectura, color_icumsa, turbidez, humedad, cenizas, sediment_test, so2_ppm, granulometria_20, granulometria_30, calidad, silo, destino')
      .eq('fecha_industrial', maxFecha)
      .order('hora_lectura', { ascending: true });
    if (desde) q = q.gte('hora_lectura', desde);
    if (hasta) q = q.lte('hora_lectura', hasta);

    const { data, error } = await q.limit(2000);
    if (error) { this.logger.warn(`azucar: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }

  async lab(procesos: string[], desde?: string, hasta?: string) {
    let q = this.supabase.schema('legacy').from('lab_general')
      .select('proceso_codigo, fecha_industrial, hora_lectura, kilos, brix_manual, brix_automatico, pol_manual, pol_automatico, pureza')
      .order('hora_lectura', { ascending: true });
    if (procesos.length) q = q.in('proceso_codigo', procesos);
    if (desde) q = q.gte('hora_lectura', desde);
    if (hasta) q = q.lte('hora_lectura', hasta);
    const { data, error } = await q.limit(2000);
    if (error) { this.logger.warn(`lab: ${error.message}`); return { stale: true, data: [] }; }
    return { data: data ?? [] };
  }
}
