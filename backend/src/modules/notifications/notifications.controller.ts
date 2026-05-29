import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly supabase: SupabaseService) {}
  @Post('subscribe')
  @HttpCode(200)
  async subscribe(@Body() body: { endpoint: string; keys: Record<string, string>; role?: string }) {
    if (!body?.endpoint || !body?.keys) return { ok: false };
    await this.supabase.schema('industrial').from('push_subscriptions')
      .upsert({ endpoint: body.endpoint, keys: body.keys, role: body.role ?? null }, { onConflict: 'endpoint' });
    return { ok: true };
  }
}
