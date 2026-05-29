import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { AiService } from '../ai/ai.service';
import { parseTriage, alertsHash } from './triage-parse';
import { sevOrder } from './severity';

@Injectable()
export class AlertTriageService {
  private readonly logger = new Logger(AlertTriageService.name);
  private lastHash = '';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly ai: AiService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: 'America/Argentina/Buenos_Aires' })
  async triage(): Promise<void> {
    if (!this.ai.isAvailable()) return;
    const alerts = this.supabase.schema('alerts');
    const { data, error } = await alerts.from('active')
      .select('id, severity, area, title, message, metadata')
      .is('resolved_at', null);
    if (error || !data?.length) { this.lastHash = ''; return; }

    const hash = alertsHash(data.map((a) => ({ id: a.id, value: (a.metadata as { value?: number })?.value })));
    if (hash === this.lastHash) return;

    const raw = await this.ai.triageAlertas(data as Parameters<AiService['triageAlertas']>[0]);
    if (!raw) return;
    const triage = parseTriage(raw);

    for (const a of data) {
      const t = triage[a.id];
      if (!t) continue;
      const finalSev = sevOrder(t.severidad) < sevOrder(a.severity) ? t.severidad : a.severity;
      const meta = { ...(a.metadata as object), triage: t };
      await alerts.from('active').update({ severity: finalSev, metadata: meta }).eq('id', a.id);
    }
    this.lastHash = hash;
    this.logger.log(`triage aplicado a ${data.length} alertas`);
  }
}
