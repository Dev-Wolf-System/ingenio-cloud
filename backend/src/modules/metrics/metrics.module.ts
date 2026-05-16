import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { InfluxModule } from '../influx/influx.module';

@Module({
  imports: [InfluxModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
