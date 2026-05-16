import { z } from 'zod';

export const MillSpeedWebhookSchema = z.object({
  tenant_slug: z.string().optional().default('lacorona'),
  plant_slug: z.string().optional().default('planta-sur'),
  shift: z.enum(['morning', 'afternoon', 'night']),
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  promedio_rpm: z.number(),
  samples: z
    .array(
      z.object({
        timestamp: z.string().datetime(),
        rpm: z.number(),
      }),
    )
    .min(1),
});

export type MillSpeedWebhookPayload = z.infer<typeof MillSpeedWebhookSchema>;
