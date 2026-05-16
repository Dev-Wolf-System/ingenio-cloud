import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebhookSecret, WebhookSecretGuard } from '../../common/guards/webhook-secret.guard';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  MetricsWebhookSchema,
  type MetricsWebhookPayload,
} from './dto/metrics-webhook.dto';
import {
  MillSpeedWebhookSchema,
  type MillSpeedWebhookPayload,
} from './dto/mill-speed-webhook.dto';
import { WebhooksService } from './webhooks.service';

// Endpoints accept payloads desde Node-RED (vive en stack n8n_evoapi).
// Path `n8n` mantenido por compatibilidad del flow Node-RED existente.
@Controller(['webhooks/ingest', 'webhooks/n8n', 'webhooks/node-red'])
@UseGuards(WebhookSecretGuard)
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  /**
   * POST /api/webhooks/ingest/metrics-energy
   * (alias: /webhooks/node-red/* y /webhooks/n8n/*)
   *
   * Recibe lecturas agrupadas de sensores ENERGÍA (10 base) desde Node-RED.
   * Header obligatorio: x-webhook-secret = $N8N_WEBHOOK_SECRET
   *
   * Payload:
   * {
   *   "tenant_slug": "lacorona",          // opcional, default lacorona
   *   "plant_slug": "planta-sur",         // opcional, default planta-sur
   *   "source": "n8n",                    // opcional
   *   "timestamp": "2026-05-15T14:32:17Z",// opcional, server.now() si omit
   *   "metrics": [
   *     { "sensor_id": "caudal_caldera_2", "value": 62.3 },
   *     { "sensor_id": "caudal_caldera_3", "value": 58.1 },
   *     ... (sensores energía)
   *   ]
   * }
   *
   * Calculados automáticos server-side:
   *   - caudal_total_vapor = caldera_2 + caldera_3 + caldera_6
   *   - generacion_total = potencia_weg + potencia_siemens
   */
  @Post('metrics-energy')
  @WebhookSecret('N8N_WEBHOOK_SECRET')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async ingestEnergy(
    @Body(new ZodValidationPipe(MetricsWebhookSchema)) body: MetricsWebhookPayload,
  ) {
    return this.svc.ingestMetrics('energia', body);
  }

  /**
   * POST /api/webhooks/ingest/metrics-production
   * Recibe lecturas agrupadas de sensores PRODUCCIÓN (21 sensores).
   * Mismo formato que metrics-energy.
   */
  @Post('metrics-production')
  @WebhookSecret('N8N_WEBHOOK_SECRET')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async ingestProduction(
    @Body(new ZodValidationPipe(MetricsWebhookSchema)) body: MetricsWebhookPayload,
  ) {
    return this.svc.ingestMetrics('produccion', body);
  }

  /**
   * POST /api/webhooks/ingest/shift/mill-speed
   * Velocidad primer molino del turno previo (1x por cierre turno).
   * Header obligatorio: x-webhook-secret = $MILL_SPEED_WEBHOOK_SECRET
   *
   * Payload:
   * {
   *   "tenant_slug": "lacorona",
   *   "plant_slug": "planta-sur",
   *   "shift": "morning|afternoon|night",
   *   "shift_date": "2026-05-15",
   *   "promedio_rpm": 4.8,
   *   "samples": [
   *     { "timestamp": "2026-05-15T05:01:00Z", "rpm": 4.7 },
   *     ...
   *   ]
   * }
   */
  @Post('shift/mill-speed')
  @WebhookSecret('MILL_SPEED_WEBHOOK_SECRET')
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async ingestMillSpeed(
    @Body(new ZodValidationPipe(MillSpeedWebhookSchema)) body: MillSpeedWebhookPayload,
  ) {
    return this.svc.ingestMillSpeed(body);
  }
}
