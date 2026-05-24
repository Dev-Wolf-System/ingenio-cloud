import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ReportesDataService } from './reportes-data.service';
import { ReportesFormatterService } from './reportes-formatter.service';
import { ReportesWebhookService } from './reportes-webhook.service';
import { ReportesCronService } from './reportes-cron.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ReportesController],
  providers: [
    ReportesService,
    ReportesDataService,
    ReportesFormatterService,
    ReportesWebhookService,
    ReportesCronService,
  ],
  exports: [ReportesService],
})
export class ReportesModule {}
