import { Module } from '@nestjs/common';
import { MoliendaCloudController } from './molienda-cloud.controller';
import { MoliendaCloudService } from './molienda-cloud.service';

@Module({
  controllers: [MoliendaCloudController],
  providers: [MoliendaCloudService],
})
export class MoliendaCloudModule {}
