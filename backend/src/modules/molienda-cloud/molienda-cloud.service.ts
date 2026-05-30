import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
