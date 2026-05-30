import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { SupabaseService } from '../supabase/supabase.service';

export interface PushPayload { title: string; body: string; severity: string; url: string; }

@Injectable()
export class WebPushDriver {
  private readonly logger = new Logger(WebPushDriver.name);
  private ready = false;
  constructor(private readonly config: ConfigService, private readonly supabase: SupabaseService) {
    const pub = config.get<string>('VAPID_PUBLIC_KEY');
    const priv = config.get<string>('VAPID_PRIVATE_KEY');
    const subj = config.get<string>('VAPID_SUBJECT') || 'mailto:admin@ingenio.local';
    if (pub && priv) { webpush.setVapidDetails(subj, pub, priv); this.ready = true; }
    else this.logger.warn('VAPID keys vacías — push deshabilitado');
  }
  async send(payload: PushPayload): Promise<void> {
    if (!this.ready) return;
    const { data, error } = await this.supabase.schema('industrial').from('push_subscriptions').select('endpoint, keys');
    if (error) { this.logger.error(`push_subscriptions load failed: ${error.message}`); return; }
    for (const sub of data ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys } as webpush.PushSubscription,
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.supabase.schema('industrial').from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    }
  }
}
