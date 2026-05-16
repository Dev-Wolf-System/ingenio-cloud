import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AlertsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listActive() {
    const alerts = this.supabase.schema('alerts');
    const { data, error } = await alerts
      .from('active')
      .select('*')
      .is('resolved_at', null)
      .order('detected_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { alerts: data ?? [] };
  }
}
