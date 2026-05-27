import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  /** GET /api/alerts/active — alertas activas (no resueltas) */
  @Get('active')
  active() {
    return this.svc.listActive();
  }

  /** GET /api/alerts/history?limit=100&offset=0 — historial de alertas resueltas */
  @Get('history')
  history(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listHistory(
      limit ? Math.min(parseInt(limit, 10), 500) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /** GET /api/alerts/:id/analisis-causa — análisis IA de causa (cache 5min) */
  @Get(':id/analisis-causa')
  analisisCausa(@Param('id') id: string) {
    return this.svc.getAnalisisCausa(id);
  }

  /** POST /api/alerts/voice — genera audio TTS con las alertas activas indicadas */
  @Post('voice')
  @HttpCode(200)
  async voice(
    @Body() body: { alertIds?: string[] },
    @Res() res: Response,
  ): Promise<void> {
    const ids = body?.alertIds ?? [];
    if (!ids.length) {
      res.status(400).json({ error: 'alertIds requerido' });
      return;
    }
    const audio = await this.svc.generarAudioAlertas(ids);
    if (!audio) {
      res.status(503).json({ available: false });
      return;
    }
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', String(audio.byteLength));
    res.set('Cache-Control', 'no-store');
    res.send(audio);
  }
}
