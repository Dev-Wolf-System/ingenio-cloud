import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { EnergiaGateway, ProduccionGateway, MolinoGateway } from './realtime.gateway';
import { GuardiaIngestController } from './realtime.controller';

@Module({
  controllers: [GuardiaIngestController],
  providers: [RealtimeService, EnergiaGateway, ProduccionGateway, MolinoGateway],
})
export class RealtimeModule {}
