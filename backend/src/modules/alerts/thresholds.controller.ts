import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ThresholdsService, type ThresholdArea, type ThresholdRow } from './thresholds.service';

@Controller('alerts/thresholds')
export class ThresholdsController {
  constructor(private readonly svc: ThresholdsService) {}

  /** GET /api/alerts/thresholds?area=energia|produccion|trapiche */
  @Get()
  list(@Query('area') area?: ThresholdArea) {
    return this.svc.list(area);
  }

  /** POST /api/alerts/thresholds — batch upsert */
  @Post()
  upsertMany(@Body() body: { thresholds: ThresholdRow[] }) {
    return this.svc.upsertMany(body?.thresholds ?? []);
  }

  /** DELETE /api/alerts/thresholds/:id */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  /**
   * POST /api/alerts/thresholds/config/verify
   * Verifica la contraseña de configuración sin exponerla en el bundle del cliente.
   * La contraseña vive solo en CONFIG_PASSWORD (env del servidor).
   */
  @Post('config/verify')
  @HttpCode(200)
  verifyConfigPassword(@Body() body: { password?: string }): { ok: boolean } {
    const expected = process.env.CONFIG_PASSWORD;
    if (!expected) return { ok: false };
    return { ok: body.password === expected };
  }
}
