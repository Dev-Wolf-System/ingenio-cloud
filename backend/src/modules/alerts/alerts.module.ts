import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ThresholdsController } from './thresholds.controller';
import { ThresholdsService } from './thresholds.service';

@Module({
  controllers: [AlertsController, ThresholdsController],
  providers: [AlertsService, ThresholdsService],
})
export class AlertsModule {}
