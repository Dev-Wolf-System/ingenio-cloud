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
    if (error) return; // error transitorio: no resetear hash para no re-llamar GPT al próximo tick
    if (!data?.length) { this.lastHash = ''; return; }

    const hash = alertsHash(data.map((a) => ({ id: a.id, value: (a.metadata as { value?: number })?.value })));
    if (hash === this.lastHash) return;

    const payload = data.map((a) => ({
      id: a.id as string,
      severity: a.severity as string,
      area: a.area as string,
      title: a.title as string,
      message: (a.message ?? '') as string,
      metadata: (a.metadata ?? {}) as { value?: number; unit?: string; min_value?: number; max_value?: number },
    }));
    const raw = await this.ai.triageAlertas(payload);
    if (!raw) return;
    const triage = parseTriage(raw);

    // NOTA: ThresholdEvaluatorService (cron 30s) puede escribir metadata/severity en paralelo.
    // La severidad nunca baja (se conserva la más alta vía sevOrder). En el peor caso una
    // escalada concurrente puede pisar el campo metadata.triage; se recalcula al próximo tick.
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
