import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { GuardiaIngestController } from './realtime.controller';

@Module({
  controllers: [GuardiaIngestController],
  providers: [RealtimeService],
})
export class RealtimeModule {}
