import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReportePayload } from './reportes.types';

export interface WebhookResult {
  status: number;
  body: string;
  ok: boolean;
}

@Injectable()
export class ReportesWebhookService {
  private readonly logger = new Logger(ReportesWebhookService.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: ReportePayload): Promise<WebhookResult> {
    const url = this.config.get<string>('WEBHOOK_REPORTE_TURNO_URL');
    const secret = this.config.get<string>('WEBHOOK_REPORTE_TURNO_SECRET');
    if (!url) {
      this.logger.warn('WEBHOOK_REPORTE_TURNO_URL no configurada — skip envío');
      return { status: 0, body: 'webhook url no configurada', ok: false };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-webhook-secret': secret } : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      return { status: res.status, body: body.slice(0, 2000), ok: res.ok };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`webhook POST falló: ${msg}`);
      return { status: 0, body: msg, ok: false };
    }
  }
}
