import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AlertsAnalisisService } from './alerts-analisis.service';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly svc: AlertsService,
    private readonly analisisSvc: AlertsAnalisisService,
  ) {}

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

  /** GET /api/alerts/history/resumen?limit=100 — resumen IA del historial de alertas */
  @Get('history/resumen')
  historyResumen(@Query('limit') limit?: string) {
    return this.svc.resumenHistorial(limit ? Math.min(parseInt(limit, 10), 500) : 100);
  }

  /** GET /api/alerts/analisis?periodo=turno|dia|zafra&refresh=1 */
  @Get('analisis')
  analisis(@Query('periodo') periodo?: string, @Query('refresh') refresh?: string) {
    const p = (['turno', 'dia', 'zafra'] as const).includes(periodo as never) ? (periodo as 'turno' | 'dia' | 'zafra') : 'dia';
    return this.analisisSvc.analisis(p, refresh === '1');
  }

  /** GET /api/alerts/:id/analisis-causa — análisis IA de causa (cache 5min) */
  @Get(':id/analisis-causa')
  analisisCausa(@Param('id') id: string) {
    return this.svc.getAnalisisCausa(id);
  }

  /** POST /api/alerts/voice-text — genera audio TTS desde texto libre (normalización) */
  @Post('voice-text')
  @HttpCode(200)
  async voiceText(
    @Body() body: { text?: string },
    @Res() res: Response,
  ): Promise<void> {
    const text = (body?.text ?? '').trim().slice(0, 300);
    if (!text) { res.status(400).json({ error: 'text requerido' }); return; }
    const audio = await this.svc.generarAudioTexto(text);
    if (!audio) { res.status(503).json({ available: false }); return; }
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', String(audio.byteLength));
    res.set('Cache-Control', 'no-store');
    res.send(audio);
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
