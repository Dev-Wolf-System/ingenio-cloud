import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  TZ: z.string().default('America/Argentina/Buenos_Aires'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // URLs
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url().optional(),

  // Webhooks
  N8N_WEBHOOK_SECRET: z.string().min(8),
  MILL_SPEED_WEBHOOK_SECRET: z.string().min(8),

  // MSSQL CORONA
  MSSQL_HOST: z.string().default('192.168.0.177'),
  MSSQL_PORT: z.coerce.number().default(1433),
  MSSQL_DATABASE: z.string().default('CORONA'),
  MSSQL_USER: z.string().default('fs1'),
  MSSQL_PASSWORD: z.string().optional().default(''),
  MSSQL_ENCRYPT: z.coerce.boolean().default(false),
  MSSQL_TRUST_SERVER_CERTIFICATE: z.coerce.boolean().default(true),

  // External HTTP molienda
  MOLIENDA_HTTP_URL: z.string().optional(),
  MOLIENDA_HTTP_AUTH: z.string().optional(),

  // Node-RED endpoint para consultar guardia anterior (PULL)
  NODERED_GUARDIA_URL: z.string().optional().default('https://nodered.srv878399.hstgr.cloud/api/resumen-guardia/'),
  NODERED_AUTH: z.string().optional(),

  // InfluxDB 3 (histórico raw)
  INFLUX_URL: z.string().optional(),
  INFLUX_TOKEN: z.string().optional(),
  INFLUX_DATABASE: z.string().optional().default('corona2026'),

  // IA (Sprint 1+)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Comms
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),

  // Reportes de turno (webhook genérico → n8n maneja routing Telegram)
  WEBHOOK_REPORTE_TURNO_URL: z.string().url().optional(),
  WEBHOOK_REPORTE_TURNO_SECRET: z.string().optional(),
  REPORTE_TURNO_ENABLED: z.string().optional().default('true'),
  REPORTE_TURNO_RETRY_INTERVAL_MINUTES: z.coerce.number().default(1),
  REPORTE_TURNO_RETRY_MAX_HOURS: z.coerce.number().default(4),

  // Defaults
  DEFAULT_TENANT_SLUG: z.string().default('lacorona'),
  DEFAULT_PLANT_SLUG: z.string().default('planta-sur'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid env vars:', result.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  return result.data;
}
