import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { EnergiaGateway, ProduccionGateway, MolinoGateway } from './realtime.gateway';

@Module({
  providers: [RealtimeService, EnergiaGateway, ProduccionGateway, MolinoGateway],
})
export class RealtimeModule {}
