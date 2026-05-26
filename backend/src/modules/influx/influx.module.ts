import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { InfluxGasService } from './influx-gas.service';
import { InfluxQueryService } from './influx-query.service';
import { InfluxHealthController } from './influx-health.controller';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [InfluxHealthController],
  providers: [InfluxQueryService, InfluxGasService],
  exports: [InfluxQueryService, InfluxGasService],
})
export class InfluxModule {}
