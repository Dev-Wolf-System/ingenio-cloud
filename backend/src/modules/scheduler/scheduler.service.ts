import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { GuardiaService } from '../guardia/guardia.service';
import { InfluxGasService } from '../influx/influx-gas.service';
import { InfluxDashboardSyncService } from '../influx/influx-dashboard-sync.service';

/**
 * Cron jobs internos del backend.
 * Timezone forzado America/Argentina/Buenos_Aires.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private dashboardSyncRunning = false;

  constructor(
    private readonly guardia: GuardiaService,
    private readonly influxGas: InfluxGasService,
    private readonly influxDashboard: InfluxDashboardSyncService,
  ) {}

  /**
   * Refresco de señales dashboard (energía/trapiche/producción) leyendo
   * directo de InfluxDB cada 1s — reemplaza la ingesta por WebSocket de Node-RED
   * para las señales que existen en Influx. Guard anti-solape: si una corrida
   * tarda más de 1s, se saltea el siguiente tick en vez de amontonar requests.
   */
  @Interval(1000)
  async syncDashboardFromInflux() {
    if (this.dashboardSyncRunning) return;
    this.dashboardSyncRunning = true;
    try {
      await this.influxDashboard.syncAll();
    } catch (err) {
      this.logger.warn('Cron sync dashboard influx failed', err as Error);
    } finally {
      this.dashboardSyncRunning = false;
    }
  }

  /**
   * Refrescar resumen guardia desde Node-RED a los 15 min de cada cambio de turno.
   * Disparos: 05:15, 13:15, 21:15 ART (hora local AR).
   * Cron format: minute hour day month dayOfWeek
   */
  @Cron('15 5,13,21 * * *', {
    name: 'refresh_guardia_resumen',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async refreshGuardiaResumen() {
    this.logger.log('Cron: refresh guardia resumen (force=true)');
    try {
      const result = await this.guardia.getResumenGuardia(true);
      this.logger.log(`Cron: refresh OK turno=${(result as { turno_anterior?: string }).turno_anterior ?? 'n/a'}`);
    } catch (err) {
      this.logger.error('Cron refresh guardia failed', err as Error);
    }
  }

  /**
   * Retry suave 5 min después por si Node-RED tardó (cron principal pudo perder el dato).
   * Si cache ya está fresco, no hace nada.
   */
  @Cron('20 5,13,21 * * *', {
    name: 'retry_guardia_resumen',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async retryGuardiaResumen() {
    this.logger.log('Cron: retry guardia resumen (force=true) por si principal falló');
    try {
      await this.guardia.getResumenGuardia(true);
    } catch (err) {
      this.logger.warn('Cron retry guardia failed', err as Error);
    }
  }

  /**
   * Bootstrap: al iniciar el backend, intenta cargar resumen guardia inmediatamente.
   * Útil después de un reinicio.
   */
  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'bootstrap_guardia_resumen',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async warmupCache() {
    // Solo intenta si no hay cache válido — getResumenGuardia ya tiene logic interna
    try {
      await this.guardia.getResumenGuardia(false);
    } catch {
      // silent
    }
  }

  /**
   * Análisis IA del turno previo: cada 15 min revisa si hay datos nuevos.
   * generarAnalisisIA usa huella de datos — si no cambió, no llama a OpenAI
   * (no quema tokens). Solo regenera cuando el dato del turno previo cambia.
   */
  @Cron('0 */15 * * * *', {
    name: 'analisis_ia_guardia',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async analisisIAGuardia() {
    try {
      const r = await this.guardia.generarAnalisisIA();
      if (r.ok) {
        this.logger.log(
          `Cron IA: ${r.regenerado ? 'regenerado (datos nuevos)' : 'sin cambios — cache vigente'}`,
        );
      } else {
        this.logger.warn(`Cron IA: ${r.error}`);
      }
    } catch (err) {
      this.logger.warn('Cron analisis IA failed', err as Error);
    }
  }

  /**
   * Cada minuto: trae promedio últimos 60 min de gas desde InfluxDB3
   * y upserta en production.gas_hora_estimado como fallback
   * cuando el lab aún no cargó el dato real.
   */
  @Cron('* * * * *', {
    name: 'sync_gas_estimado',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async syncGasEstimado() {
    try {
      await this.influxGas.syncGasEstimado();
    } catch (err) {
      this.logger.warn('Cron sync gas estimado failed', err as Error);
    }
  }
}
