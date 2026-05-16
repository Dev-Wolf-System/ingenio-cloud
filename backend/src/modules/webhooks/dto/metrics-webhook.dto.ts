import { z } from 'zod';

export const MetricItemSchema = z.object({
  sensor_id: z.string().min(1),
  value: z.union([z.number(), z.string()]).transform((v) => (typeof v === 'string' ? parseFloat(v) : v)),
  unit: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export const MetricsWebhookSchema = z.object({
  tenant_slug: z.string().optional().default('lacorona'),
  plant_slug: z.string().optional().default('planta-sur'),
  source: z.enum(['n8n', 'node-red', 'manual']).default('n8n'),
  timestamp: z.string().datetime().optional(),
  metrics: z.array(MetricItemSchema).min(1).max(100),
});

export type MetricsWebhookPayload = z.infer<typeof MetricsWebhookSchema>;
