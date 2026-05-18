import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listActive() {
    try {
      const alerts = this.supabase.schema('alerts');
      const { data, error } = await alerts
        .from('active')
        .select('*')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false });
      if (error) {
        this.logger.warn(`listActive fail: ${error.message}`);
        return { alerts: [], stale: true };
      }
      return { alerts: data ?? [] };
    } catch (err) {
      this.logger.warn(`listActive exception: ${(err as Error).message}`);
      return { alerts: [], stale: true };
    }
  }
}
