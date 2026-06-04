import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { GuardiaModule } from './modules/guardia/guardia.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { HealthModule } from './modules/health/health.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AiModule } from './modules/ai/ai.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { InfluxModule } from './modules/influx/influx.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MoliendaCloudModule } from './modules/molienda-cloud/molienda-cloud.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers["x-webhook-secret"]'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    SupabaseModule,
    WebhooksModule,
    GuardiaModule,
    MetricsModule,
    AlertsModule,
    HealthModule,
    AiModule,
    RealtimeModule,
    SchedulerModule,
    ReportesModule,
    InfluxModule,
    NotificationsModule,
    MoliendaCloudModule,
  ],
})
export class AppModule {}
