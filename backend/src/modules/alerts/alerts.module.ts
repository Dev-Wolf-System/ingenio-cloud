import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ThresholdsController } from './thresholds.controller';
import { ThresholdsService } from './thresholds.service';
import { ThresholdEvaluatorService } from './threshold-evaluator.service';
import { AlertTriageService } from './alert-triage.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AlertsController, ThresholdsController],
  providers: [AlertsService, ThresholdsService, ThresholdEvaluatorService, AlertTriageService],
})
export class AlertsModule {}
