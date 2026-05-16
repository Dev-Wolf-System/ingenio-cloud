import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller()
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get('health')
  async health() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};
    try {
      const { error } = await this.supabase
        .schema('industrial')
        .from('sensor_mapping')
        .select('sensor_id', { count: 'exact', head: true });
      checks.supabase = { ok: !error, detail: error?.message };
    } catch (e) {
      checks.supabase = { ok: false, detail: (e as Error).message };
    }
    const ok = Object.values(checks).every((c) => c.ok);
    return { status: ok ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
  }
}
