import { Module } from '@nestjs/common';
import { GuardiaController } from './guardia.controller';
import { GuardiaService } from './guardia.service';
import { InfluxModule } from '../influx/influx.module';

@Module({
  imports: [InfluxModule],
  controllers: [GuardiaController],
  providers: [GuardiaService],
  exports: [GuardiaService],
})
export class GuardiaModule {}
