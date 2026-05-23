import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GuardiaModule } from '../guardia/guardia.module';
import { InfluxModule } from '../influx/influx.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), GuardiaModule, InfluxModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
