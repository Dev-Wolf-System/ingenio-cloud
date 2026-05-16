import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { WebhookSecret, WebhookSecretGuard } from '../../common/guards/webhook-secret.guard';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { RealtimeService } from './realtime.service';

const ParadasSchema = z.object({
  cantidad_paradas: z.number().optional(),
  tiempo_neto_total_min: z.number().optional(),
  mensaje: z.string().optional(),
  detalle: z.array(z.any()).optional(),
}).passthrough();

const MoliendaSchema = z.object({
  cantidad_registros: z.number().optional(),
  molienda_promedio_kg_h: z.number().optional(),
  molienda_total_kg: z.number().optional(),
  molienda_maxima_kg_h: z.number().optional(),
  molienda_minima_kg_h: z.number().optional(),
  mensaje: z.string().optional(),
}).passthrough();

const ConsumoGasSchema = z.object({
  cantidad_registros: z.number().optional(),
  consumo_total_m3: z.number().optional(),
  'consumo_promedio_m3/h': z.number().optional(),
  'consumo_maximo_m3/h': z.number().optional(),
  'consumo_minimo_m3/h': z.number().optional(),
  mensaje: z.string().optional(),
}).passthrough();

const GuardiaIngestSchema = z.object({
  turno_anterior: z.enum(['MAÑANA', 'TARDE', 'NOCHE']),
  desde: z.string(),
  hasta: z.string(),
  timestamp_consulta: z.string().optional(),
  paradasFabrica: ParadasSchema,
  moliendaPromedio: MoliendaSchema,
  consumoGas: ConsumoGasSchema,
});

type GuardiaIngestPayload = z.infer<typeof GuardiaIngestSchema>;

@Controller('guardia')
@UseGuards(WebhookSecretGuard)
export class GuardiaIngestController {
  constructor(private readonly svc: RealtimeService) {}

  /**
   * POST /api/guardia/ingest
   * Recibe resumen turno anterior desde Node-RED.
   * Header: x-webhook-secret = $N8N_WEBHOOK_SECRET (opcional si vacío en .env)
   */
  @Post('ingest')
  @WebhookSecret('N8N_WEBHOOK_SECRET')
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async ingest(
    @Body(new ZodValidationPipe(GuardiaIngestSchema)) body: GuardiaIngestPayload,
  ) {
    return this.svc.ingestGuardiaResumen(body);
  }
}
