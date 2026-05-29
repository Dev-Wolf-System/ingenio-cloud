import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI | null = null;
  private model = 'gpt-4o-mini';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY vacío — AI deshabilitado');
      return;
    }
    this.client = new OpenAI({ apiKey });
    this.logger.log(`OpenAI client ready (model=${this.model})`);
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async analizarResumenGuardia(payload: {
    turno?: string | null;
    turno_inicio?: string | null;
    turno_fin?: string | null;
    molienda_avg_t_h?: number | null;
    gas_total_m3?: number | null;
    gas_avg_m3_h?: number | null;
    paradas_count?: number | null;
    paradas_minutos?: number | null;
    paradas_detalle?: Array<{
      desde: string;
      hasta: string;
      rango?: string;
      estado?: string;
      motivo: string;
      origen?: string;
      maquina?: string;
      minutos_neto?: number | null;
    }>;
  }): Promise<{
    resumen: string;
    estado: 'normal' | 'atencion' | 'critico';
    puntos_clave: string[];
  } | null> {
    if (!this.client) return null;

    const systemPrompt = `Sos un ingeniero senior experto en ingenios azucareros (Ingenio La Corona, Tucumán Argentina).
Análisis turno operativo en base a:
- Paradas de fábrica con DETALLE por evento (motivo, hora, duración)
- Molienda promedio (t/h)
- Consumo de gas total y promedio (m³, m³/h)

Tu trabajo: dar un comentario operativo profesional, claro y conciso para gerentes/jefes turno.
Si hay paradas, mencioná los motivos más relevantes y su impacto en tiempo.
Tono: directo, técnico, en español rioplatense.
Salida JSON estricto con campos:
- resumen (string 2-3 oraciones)
- estado (normal|atencion|critico)
- puntos_clave (array 3-5 bullets cortos, mencionando paradas si las hubo)`;

    const paradasFmt = (payload.paradas_detalle ?? []).length > 0
      ? (payload.paradas_detalle ?? [])
          .map((p) => {
            const dur = p.minutos_neto != null ? `${p.minutos_neto} min` : 'abierta';
            const rango = p.rango ?? `${p.desde} → ${p.hasta}`;
            const maquinaOrigen = [p.maquina, p.origen].filter(Boolean).join(' · ');
            return `- ${rango} (${dur}) · ${p.motivo}${maquinaOrigen ? ` [${maquinaOrigen}]` : ''}`;
          })
          .join('\n')
      : '(sin paradas registradas)';

    const userPrompt = `Turno: ${payload.turno ?? '—'}
Periodo: ${payload.turno_inicio ?? '?'} → ${payload.turno_fin ?? '?'}

Molienda promedio: ${payload.molienda_avg_t_h ?? '—'} t/h
Gas total: ${payload.gas_total_m3 ?? '—'} m³ (promedio ${payload.gas_avg_m3_h ?? '—'} m³/h)
Paradas: ${payload.paradas_count ?? 0} evento(s), ${payload.paradas_minutos ?? 0} min total

Detalle de paradas:
${paradasFmt}

Analizá el desempeño del turno considerando los motivos de paradas.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 500,
        messages,
      });

      const choice = res.choices[0];
      const content = choice?.message?.content ?? '';
      const finishReason = choice?.finish_reason;

      this.logger.log(
        `LLM raw: finish=${finishReason} tokens=${res.usage?.total_tokens ?? '?'} content_len=${content.length}`,
      );

      if (!content || content.trim().length === 0) {
        this.logger.warn(`LLM devolvió contenido vacío (finish_reason=${finishReason})`);
        return null;
      }

      // 1. Limpiar fences markdown ```json ... ```
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      }

      // 2. Extraer el primer objeto JSON balanceado { ... } del contenido
      //    (gpt a veces antepone texto narrativo antes del JSON)
      const tryExtractJson = (str: string): string | null => {
        const start = str.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < str.length; i++) {
          const ch = str[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\') { escape = true; continue; }
          if (ch === '"') inString = !inString;
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) return str.slice(start, i + 1);
          }
        }
        return null;
      };

      const extracted = tryExtractJson(cleaned);
      if (!extracted) {
        this.logger.warn(`No se encontró objeto JSON. Raw: "${cleaned.slice(0, 300)}"`);
        return null;
      }

      let parsed: {
        resumen?: string;
        estado?: 'normal' | 'atencion' | 'critico';
        puntos_clave?: string[];
      };
      try {
        parsed = JSON.parse(extracted);
      } catch (parseErr) {
        this.logger.warn(
          `JSON parse falló. Extracted: "${extracted.slice(0, 300)}". Error: ${(parseErr as Error).message}`,
        );
        return null;
      }

      this.logger.log(`LLM análisis OK · estado=${parsed.estado ?? 'normal'}`);

      return {
        resumen: parsed.resumen ?? 'Sin análisis disponible.',
        estado: parsed.estado ?? 'normal',
        puntos_clave: Array.isArray(parsed.puntos_clave) ? parsed.puntos_clave : [],
      };
    } catch (err) {
      const errAny = err as { status?: number; code?: string; message?: string };
      const detail =
        errAny.status
          ? `HTTP ${errAny.status} ${errAny.code ?? ''} ${errAny.message ?? ''}`
          : errAny.message ?? String(err);
      this.logger.error(`OpenAI analyze failed: ${detail}`);
      return null;
    }
  }

  async triageAlertas(
    alerts: Array<{ id: string; severity: string; area: string; title: string; message: string; metadata: { value?: number; unit?: string; min_value?: number; max_value?: number } }>,
  ): Promise<string | null> {
    if (!this.client) return null;
    const systemPrompt = `Sos ingeniero senior de un ingenio azucarero (La Corona, Tucumán).
Recibís TODAS las alertas activas a la vez. Tu trabajo: agrupar las que comparten causa raíz,
priorizar y recomendar. Considerá correlaciones (vapor↔gas, temperatura↔caudal vapor, etc).
Salida JSON estricto:
{ "alerts": [ { "id": "<id>", "severidad_recalibrada": "info|warn|critical",
  "grupo_causa": "<clave corta común a alertas relacionadas>", "prioridad": <1=mayor>,
  "titular": "<frase ejecutiva>", "recomendacion": "<acción concreta>" } ] }
No bajes una severidad por debajo de la informada si ya es crítica.`;
    const userPrompt = `Alertas activas:\n${alerts.map((a) => {
      const m = a.metadata ?? {};
      return `- id=${a.id} [${a.severity}] ${a.area}: ${a.title} (valor ${m.value ?? '—'}${m.unit ? ' ' + m.unit : ''}, rango ${m.min_value ?? '—'}..${m.max_value ?? '—'})`;
    }).join('\n')}`;
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      return res.choices[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.error(`triageAlertas failed: ${(err as Error).message}`);
      return null;
    }
  }

  async generarVozAlertas(text: string): Promise<Buffer | null> {
    if (!this.client) return null;
    try {
      const response = await (this.client.audio.speech.create as unknown as (params: Record<string, unknown>) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>)({
        model: 'gpt-4o-mini-tts',
        voice: 'coral',
        input: text,
        response_format: 'mp3',
        instructions:
          'Hablá en español latinoamericano neutro, sin ningún acento extranjero. ' +
          'Pronunciá todos los números, unidades y palabras técnicas en español. ' +
          'Tono profesional, claro y directo, como un sistema de monitoreo industrial.',
      });
      const arrayBuffer = await response.arrayBuffer();
      this.logger.log(`TTS generado (${text.length} chars, ${arrayBuffer.byteLength} bytes)`);
      return Buffer.from(arrayBuffer);
    } catch (err) {
      this.logger.error(`TTS failed: ${(err as Error).message}`);
      return null;
    }
  }

  async resumenHistorial(payload: {
    total: number;
    byArea: Record<string, number>;
    bySeverity: Record<string, number>;
    byTurno: Record<string, number>;
    avgDurationMin: number;
    maxDurationMin: number;
    top5Sensors: Array<{ title: string; count: number }>;
  }): Promise<{ resumen: string; patrones: string[]; recomendaciones: string[] } | null> {
    if (!this.client) return null;

    const systemPrompt = `Sos un ingeniero senior experto en ingenios azucareros (Ingenio La Corona, Tucumán, Argentina).
Analizás el historial de alertas resueltas del sistema de monitoreo industrial.
Detectá patrones, tendencias y problemáticas recurrentes.
Tono: técnico, directo, en español rioplatense.
Salida JSON estricto con campos:
- resumen (string, 2-3 oraciones describiendo el período)
- patrones (array 3-5 strings: patrones o tendencias detectadas)
- recomendaciones (array 2-4 strings: acciones concretas para reducir alertas)`;

    const areaLines = Object.entries(payload.byArea)
      .sort((a, b) => b[1] - a[1])
      .map(([area, cnt]) => `  ${area}: ${cnt}`)
      .join('\n');

    const sevLines = Object.entries(payload.bySeverity)
      .sort((a, b) => b[1] - a[1])
      .map(([sev, cnt]) => `  ${sev}: ${cnt}`)
      .join('\n');

    const turnoLines = Object.entries(payload.byTurno)
      .map(([t, cnt]) => `  ${t}: ${cnt}`)
      .join('\n');

    const topLines = payload.top5Sensors
      .map((s, i) => `  ${i + 1}. "${s.title}" (${s.count} veces)`)
      .join('\n');

    const userPrompt = `Historial de alertas resueltas (últimas ${payload.total}):

Por área:
${areaLines || '  (sin datos)'}

Por severidad:
${sevLines || '  (sin datos)'}

Por turno:
${turnoLines || '  (sin datos)'}

Duración promedio: ${payload.avgDurationMin} min | Máxima: ${payload.maxDurationMin} min

Top 5 alertas más frecuentes:
${topLines || '  (sin datos)'}

Analizá patrones, identificá áreas/turnos problemáticos y recomendá acciones.`;

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const choice = res.choices[0];
      const content = choice?.message?.content ?? '';
      if (!content.trim()) {
        this.logger.warn('resumenHistorial: LLM devolvió contenido vacío');
        return null;
      }

      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      }

      // Extraer primer objeto JSON balanceado
      const tryExtractJson = (str: string): string | null => {
        const start = str.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < str.length; i++) {
          const ch = str[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\') { escape = true; continue; }
          if (ch === '"') inString = !inString;
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) return str.slice(start, i + 1);
          }
        }
        return null;
      };

      const extracted = tryExtractJson(cleaned);
      if (!extracted) {
        this.logger.warn(`resumenHistorial: no se encontró JSON. Raw: "${cleaned.slice(0, 300)}"`);
        return null;
      }

      let parsed: { resumen?: string; patrones?: string[]; recomendaciones?: string[] };
      try {
        parsed = JSON.parse(extracted);
      } catch (parseErr) {
        this.logger.warn(`resumenHistorial: JSON parse falló. Error: ${(parseErr as Error).message}`);
        return null;
      }

      this.logger.log(`resumenHistorial OK · tokens=${res.usage?.total_tokens ?? '?'}`);
      return {
        resumen: parsed.resumen ?? 'Sin análisis disponible.',
        patrones: Array.isArray(parsed.patrones) ? parsed.patrones : [],
        recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones : [],
      };
    } catch (err) {
      this.logger.error(`resumenHistorial failed: ${(err as Error).message}`);
      return null;
    }
  }

  async analizarPeriodoAlertas(payload: {
    periodo: string; etiqueta: string;
    kpis: { total: number; por_severidad: Record<string, number>; por_area: Record<string, number>; duracion_media_min: number; mtbf_min: number | null };
    comparativa: { total_prev: number | null; delta_pct: number | null } | null;
    sensores: Array<{ titulo: string; n: number; mtbf_min: number | null }>;
    correlaciones: Array<{ a: string; b: string; juntas: number }>;
    paradas: Array<{ motivo: string; minutos: number | null; alertas_relacionadas: number }>;
  }): Promise<{ resumen: string; patrones: string[]; recomendaciones: string[] } | null> {
    if (!this.client) return null;
    const systemPrompt = `Sos ingeniero senior de un ingenio azucarero (La Corona, Tucumán).
Analizás el período de alertas e INTERPRETÁS (no listás): destacá el cambio vs período
anterior, el sensor más problemático, correlaciones relevantes, y especialmente SI alguna
PARADA de fábrica se relaciona con alertas previas (causa probable). Español rioplatense.
Salida JSON estricto: { resumen (2-4 oraciones), patrones (array 3-5), recomendaciones (array 2-4 priorizadas) }`;
    const userPrompt = `Período: ${payload.etiqueta}
KPIs: ${JSON.stringify(payload.kpis)}
Comparativa vs anterior: ${JSON.stringify(payload.comparativa)}
Top sensores: ${payload.sensores.slice(0, 5).map((s) => `${s.titulo} (${s.n}x, MTBF ${s.mtbf_min ?? '—'}min)`).join('; ')}
Correlaciones: ${payload.correlaciones.slice(0, 5).map((c) => `${c.a}+${c.b} (${c.juntas}x)`).join('; ') || 'ninguna'}
Paradas: ${payload.paradas.map((p) => `${p.motivo} (${p.minutos ?? '?'}min, ${p.alertas_relacionadas} alertas cerca)`).join('; ') || 'ninguna'}`;
    try {
      const res = await this.client.chat.completions.create({
        model: this.model, response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 600,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      });
      const content = res.choices[0]?.message?.content ?? '';
      if (!content.trim()) return null;
      let c = content.trim();
      if (c.startsWith('```')) c = c.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const s = c.indexOf('{'); const e = c.lastIndexOf('}');
      if (s === -1 || e === -1) return null;
      const p = JSON.parse(c.slice(s, e + 1)) as { resumen?: string; patrones?: string[]; recomendaciones?: string[] };
      return {
        resumen: p.resumen ?? 'Sin análisis disponible.',
        patrones: Array.isArray(p.patrones) ? p.patrones : [],
        recomendaciones: Array.isArray(p.recomendaciones) ? p.recomendaciones : [],
      };
    } catch (err) {
      this.logger.error(`analizarPeriodoAlertas failed: ${(err as Error).message}`);
      return null;
    }
  }

  async analizarAlertaCausa(alert: {
    id: string;
    severity: string;
    area: string;
    title: string;
    message: string;
    metadata: { value?: number; min_value?: number; max_value?: number; unit?: string; updated_at?: string };
    detected_at: string;
  }): Promise<{
    causa_probable: string;
    factores_contribuyentes: string[];
    acciones_sugeridas: string[];
  } | null> {
    if (!this.client) return null;

    const { area, title, message, metadata, severity, detected_at } = alert;
    const valorStr = metadata?.value != null ? `${metadata.value}${metadata.unit ? ' ' + metadata.unit : ''}` : '—';
    const rangoStr =
      metadata?.min_value != null || metadata?.max_value != null
        ? `rango normal [${metadata.min_value ?? '—'} – ${metadata.max_value ?? '—'}${metadata.unit ? ' ' + metadata.unit : ''}]`
        : '';
    const detectedAgo = detected_at
      ? `detectada hace ${Math.round((Date.now() - new Date(detected_at).getTime()) / 60_000)} min`
      : '';

    const systemPrompt = `Sos un ingeniero senior experto en ingenios azucareros (Ingenio La Corona, Tucumán, Argentina).
Analizás alertas operativas en tiempo real para dar contexto inmediato al jefe de turno.
Tono: técnico, directo, en español rioplatense.
Salida JSON estricto:
- causa_probable (string, 1-2 oraciones)
- factores_contribuyentes (array 2-4 strings cortos)
- acciones_sugeridas (array 2-3 strings, acciones concretas)`;

    const userPrompt = `ALERTA ${severity.toUpperCase()} — Área: ${area}
Título: ${title}
Detalle: ${message}
Valor actual: ${valorStr}${rangoStr ? ` (${rangoStr})` : ''}
${detectedAgo}

Explicá la causa probable y qué debe hacer el operador ahora.`;

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = res.choices[0]?.message?.content ?? '';
      if (!content.trim()) return null;

      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      }
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) return null;

      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        causa_probable?: string;
        factores_contribuyentes?: string[];
        acciones_sugeridas?: string[];
      };

      this.logger.log(`Alert causa análisis OK (id=${alert.id.slice(0, 8)}...)`);
      return {
        causa_probable: parsed.causa_probable ?? 'Sin análisis disponible.',
        factores_contribuyentes: Array.isArray(parsed.factores_contribuyentes) ? parsed.factores_contribuyentes : [],
        acciones_sugeridas: Array.isArray(parsed.acciones_sugeridas) ? parsed.acciones_sugeridas : [],
      };
    } catch (err) {
      this.logger.error(`analizarAlertaCausa failed: ${(err as Error).message}`);
      return null;
    }
  }
}
