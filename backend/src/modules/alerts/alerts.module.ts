import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ThresholdsController } from './thresholds.controller';
import { ThresholdsService } from './thresholds.service';
import { ThresholdEvaluatorService } from './threshold-evaluator.service';
import { AlertTriageService } from './alert-triage.service';
import { AlertsAnalisisService } from './alerts-analisis.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SectionEditGuard } from '../../common/guards/section-edit.guard';

@Module({
  imports: [NotificationsModule],
  controllers: [AlertsController, ThresholdsController],
  providers: [
    AlertsService,
    ThresholdsService,
    ThresholdEvaluatorService,
    AlertTriageService,
    AlertsAnalisisService,
    SectionEditGuard,
  ],
})
export class AlertsModule {}
