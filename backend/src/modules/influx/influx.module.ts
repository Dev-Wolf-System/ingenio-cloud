import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { InfluxGasService } from './influx-gas.service';

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [InfluxGasService],
  exports: [InfluxGasService],
})
export class InfluxModule {}
