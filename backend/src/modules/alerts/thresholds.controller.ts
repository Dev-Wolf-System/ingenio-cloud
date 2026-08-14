import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ThresholdsService,
  type ThresholdArea,
  type ThresholdRow,
} from './thresholds.service';
import {
  RequireEditSection,
  SectionEditGuard,
} from '../../common/guards/section-edit.guard';

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
  @UseGuards(SectionEditGuard)
  @RequireEditSection('alertas')
  upsertMany(@Body() body: { thresholds: ThresholdRow[] }) {
    return this.svc.upsertMany(body?.thresholds ?? []);
  }

  /** DELETE /api/alerts/thresholds/:id */
  @Delete(':id')
  @UseGuards(SectionEditGuard)
  @RequireEditSection('alertas')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
