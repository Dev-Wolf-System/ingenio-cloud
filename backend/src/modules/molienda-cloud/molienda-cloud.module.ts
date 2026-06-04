import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { InfluxModule } from '../influx/influx.module';
import { MoliendaCloudController } from './molienda-cloud.controller';
import { MoliendaCloudService } from './molienda-cloud.service';

@Module({
  imports: [AiModule, InfluxModule],
  controllers: [MoliendaCloudController],
  providers: [MoliendaCloudService],
})
export class MoliendaCloudModule {}
