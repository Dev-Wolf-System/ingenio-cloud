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
    gas_en_paradas_m3?: number | null;
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
    parada_en_curso?: { inicio_sensor: string; duracion_horas: number } | null;
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
- Gas quemado DURANTE las paradas (combustible consumido sin moler = costo/desperdicio)

Tu trabajo: dar un comentario operativo profesional, claro y conciso para gerentes/jefes turno.
Si hay paradas, mencioná los motivos más relevantes y su impacto en tiempo.
Si hubo gas quemado durante paradas, destacalo como costo/desperdicio (combustible consumido con la fábrica detenida).
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

    const paradaEnCursoFmt = payload.parada_en_curso
      ? `\n⚠️ ESTADO ACTUAL DE FÁBRICA: EL TRAPICHE ESTÁ PARADO desde hace ${payload.parada_en_curso.duracion_horas} horas (parada continua detectada por sensor, aún sin cierre). Esta parada arranca de antes del turno analizado y sigue abierta al momento de este análisis. Mencioná este estado en tu análisis.`
      : '';

    const userPrompt = `Turno: ${payload.turno ?? '—'}
Periodo: ${payload.turno_inicio ?? '?'} → ${payload.turno_fin ?? '?'}

Molienda promedio: ${payload.molienda_avg_t_h ?? '—'} t/h
Gas total: ${payload.gas_total_m3 ?? '—'} m³ (promedio ${payload.gas_avg_m3_h ?? '—'} m³/h)
Paradas: ${payload.paradas_count ?? 0} evento(s), ${payload.paradas_minutos ?? 0} min total
Gas quemado durante paradas: ${payload.gas_en_paradas_m3 != null ? `${payload.gas_en_paradas_m3} m³${payload.gas_total_m3 ? ` (${Math.round((payload.gas_en_paradas_m3 / payload.gas_total_m3) * 100)}% del consumo del turno)` : ''}` : '—'}

Detalle de paradas:
${paradasFmt}
${paradaEnCursoFmt}
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
    kpis: { total: number; por_severidad: Record<string, number>; por_area: Record<string, number>; duracion_media_min: number };
    reliabilidad: { paradas_n: number; downtime_total_min: number; operating_min: number; mtbf_min: number | null; mttr_min: number | null; mttf_min: number | null; mtta_min: number | null };
    comparativa: { total_prev: number | null; delta_pct: number | null } | null;
    sensores: Array<{ titulo: string; n: number; mtbf_min: number | null }>;
    correlaciones: Array<{ a: string; b: string; juntas: number }>;
    paradas: Array<{ motivo: string; minutos: number | null; alertas_relacionadas: number }>;
  }): Promise<{ resumen: string; patrones: string[]; recomendaciones: string[] } | null> {
    if (!this.client) return null;
    const systemPrompt = `Sos un ingeniero MECÁNICO e INDUSTRIAL senior especializado en ingenios
azucareros (Ingenio La Corona, Tucumán). Pensás y razonás como un jefe de confiabilidad de planta.
Tu trabajo es INTERPRETAR el período (NO listar datos): conectá causas y efectos, no describas.

Marco de confiabilidad (usalo en tu razonamiento):
- MTBF = tiempo medio entre fallas (paradas). Más alto = más estable.
- MTTR = tiempo medio de reparación (downtime/parada). Más bajo = mejor respuesta de mantenimiento.
- MTTF = uptime medio antes de falla.
- MTTA = tiempo medio en reconocer una alerta. Si es alto, el operador tarda en reaccionar.
Razoná qué dicen estas métricas del estado de la planta y del mantenimiento.

Foco clave: ¿alguna PARADA estuvo PRECEDIDA por alertas (causa raíz/aviso temprano)? Si una
variable alarmó y minutos después hubo parada en la misma área/máquina, señalalo como causa probable.
Priorizá el sensor más reincidente y las correlaciones que expliquen fallas.

Español rioplatense, técnico y directo. Salida JSON estricto:
{ resumen (3-4 oraciones interpretativas), patrones (array 3-5, hallazgos), recomendaciones (array 2-4 priorizadas y accionables) }`;
    const r = payload.reliabilidad;
    const userPrompt = `Período: ${payload.etiqueta}
Alertas: total ${payload.kpis.total} · sev ${JSON.stringify(payload.kpis.por_severidad)} · por área ${JSON.stringify(payload.kpis.por_area)} · duración media alerta ${payload.kpis.duracion_media_min}min
Comparativa vs período anterior: ${payload.comparativa ? `total previo ${payload.comparativa.total_prev}, cambio ${payload.comparativa.delta_pct}%` : 'sin comparativa'}
Confiabilidad: ${r.paradas_n} paradas · downtime ${r.downtime_total_min}min · operando ${r.operating_min}min · MTBF ${r.mtbf_min ?? '—'}min · MTTR ${r.mttr_min ?? '—'}min · MTTF ${r.mttf_min ?? '—'}min · MTTA ${r.mtta_min ?? '—'}min
Top sensores (frecuencia, MTBF alerta): ${payload.sensores.slice(0, 5).map((s) => `${s.titulo} (${s.n}x, ${s.mtbf_min ?? '—'}min)`).join('; ') || 'ninguno'}
Correlaciones (alarman juntas): ${payload.correlaciones.slice(0, 5).map((c) => `${c.a}+${c.b} (${c.juntas}x)`).join('; ') || 'ninguna'}
Paradas y alertas cercanas: ${payload.paradas.map((p) => `${p.motivo} (${p.minutos ?? '?'}min, ${p.alertas_relacionadas} alertas alrededor)`).join('; ') || 'ninguna'}`;
    try {
      const res = await this.client.chat.completions.create({
        model: this.model, response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 700,
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

  async analizarParadas(payload: {
    etiqueta: string;
    reliabilidad: { paradas_n: number; downtime_total_min: number; mtbf_min: number | null; mttr_min: number | null };
    por_area: Array<{ area: string; n: number; minutos_total: number }>;
    por_motivo: Array<{ motivo: string; n: number; minutos_total: number }>;
    motivos: string[];
  }): Promise<{ resumen: string; patrones: string[]; recomendaciones: string[]; categorias: Record<string, string> } | null> {
    if (!this.client) return null;

    const systemPrompt = `Sos un ingeniero senior de MANTENIMIENTO y CONFIABILIDAD de ingenio azucarero (Ingenio La Corona, Tucumán, Argentina).
Tu trabajo: INTERPRETÁ (no listes) los datos de paradas. Conectá causas y efectos.
Analizá: MTBF/MTTR (qué dicen de la estabilidad y respuesta), el motivo/área crítico, recurrencia y dá recomendaciones priorizadas y concretas.
ADEMÁS clasificá cada motivo recibido en UNA categoría de: 'Mecánica','Eléctrica','Proceso','Trapiche','Caldera','Instrumentación','Externa','Programada','Otros'.
Español rioplatense, técnico y directo.
Salida JSON estricto:
{ "resumen": "3-4 oraciones interpretativas", "patrones": ["hallazgo1","hallazgo2",...], "recomendaciones": ["accion1 (prioridad)","accion2",...], "categorias": { "<motivo>": "<categoria>" } }
patrones: 3-5 items. recomendaciones: 2-4 priorizadas. categorias: una entrada por cada motivo recibido.`;

    const r = payload.reliabilidad;
    const userPrompt = `Período: ${payload.etiqueta}
Confiabilidad: ${r.paradas_n} paradas · downtime ${r.downtime_total_min}min · MTBF ${r.mtbf_min ?? '—'}min · MTTR ${r.mttr_min ?? '—'}min

Por área (desc por minutos):
${payload.por_area.map((a) => `  ${a.area}: ${a.n} paradas, ${a.minutos_total}min`).join('\n') || '  (sin datos)'}

Por motivo (top, desc por minutos):
${payload.por_motivo.map((m) => `  "${m.motivo}": ${m.n}x, ${m.minutos_total}min`).join('\n') || '  (sin datos)'}

Motivos a clasificar (todos los distintos):
${payload.motivos.map((m) => `  "${m}"`).join('\n') || '  (ninguno)'}

Interpretá el estado de mantenimiento/confiabilidad y clasificá cada motivo.`;

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = res.choices[0]?.message?.content ?? '';
      if (!content.trim()) {
        this.logger.warn('analizarParadas: LLM devolvió contenido vacío');
        return null;
      }

      let c = content.trim();
      if (c.startsWith('```')) c = c.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const s = c.indexOf('{'); const e = c.lastIndexOf('}');
      if (s === -1 || e === -1) {
        this.logger.warn(`analizarParadas: no se encontró JSON. Raw: "${c.slice(0, 300)}"`);
        return null;
      }

      let parsed: { resumen?: string; patrones?: string[]; recomendaciones?: string[]; categorias?: Record<string, string> };
      try {
        parsed = JSON.parse(c.slice(s, e + 1)) as typeof parsed;
      } catch (parseErr) {
        this.logger.warn(`analizarParadas: JSON parse falló: ${(parseErr as Error).message}`);
        return null;
      }

      this.logger.log(`analizarParadas OK · tokens=${res.usage?.total_tokens ?? '?'}`);
      return {
        resumen: parsed.resumen ?? 'Sin análisis disponible.',
        patrones: Array.isArray(parsed.patrones) ? parsed.patrones : [],
        recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones : [],
        categorias: (parsed.categorias && typeof parsed.categorias === 'object') ? parsed.categorias : {},
      };
    } catch (err) {
      this.logger.error(`analizarParadas failed: ${(err as Error).message}`);
      return null;
    }
  }

  async analizarCana(payload: {
    zafra: number;
    stats: { camiones: number; ton_neta: number; rto_avg: number; fincas_count: number };
    por_finca: Array<{ finca: string; camiones: number; ton_neta: number; rto: number; vs_avg: number }>;
  }): Promise<{ resumen: string; alertas: string[]; recomendaciones: string[] } | null> {
    if (!this.client) return null;

    const sorted_rto = [...payload.por_finca].sort((a, b) => a.rto - b.rto);
    const bottom5 = sorted_rto.slice(0, 5);
    const top5vol = payload.por_finca.slice(0, 5);

    const systemPrompt = `Sos un ingeniero agrónomo senior especialista en caña de azúcar (Ingenio La Corona, Tucumán, Argentina).
Analizás el rendimiento de fincas proveedoras durante la zafra.
Detectá fincas con rendimiento bajo, interpretá posibles causas agronómicas y dá recomendaciones concretas y priorizadas.
Tono: técnico, directo, en español rioplatense.
Salida JSON estricto:
{ "resumen": "2-3 oraciones del panorama general", "alertas": ["finca X: causa y riesgo"], "recomendaciones": ["accion concreta priorizada"] }
alertas: 2-4 items, solo fincas preocupantes. recomendaciones: 2-3 items accionables.`;

    const userPrompt = `Zafra: ${payload.zafra}
Total: ${payload.stats.camiones} camiones · ${payload.stats.ton_neta} t neta · ${payload.stats.fincas_count} fincas · Rto promedio: ${payload.stats.rto_avg}%

Top 5 fincas (mayor volumen):
${top5vol.map((f) => `  ${f.finca}: ${f.camiones} camiones, ${f.ton_neta}t, rto=${f.rto}% (${f.vs_avg >= 0 ? '+' : ''}${f.vs_avg}% vs avg)`).join('\n')}

Bottom 5 fincas (menor rendimiento):
${bottom5.map((f) => `  ${f.finca}: ${f.camiones} camiones, ${f.ton_neta}t, rto=${f.rto}% (${f.vs_avg >= 0 ? '+' : ''}${f.vs_avg}% vs avg)`).join('\n')}

Analizá el estado de la zafra, identificá fincas problemáticas y recomendá acciones.`;

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const content = res.choices[0]?.message?.content ?? '';
      if (!content.trim()) return null;
      let c = content.trim();
      if (c.startsWith('```')) c = c.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const s = c.indexOf('{'); const e = c.lastIndexOf('}');
      if (s === -1 || e === -1) return null;
      const p = JSON.parse(c.slice(s, e + 1)) as { resumen?: string; alertas?: string[]; recomendaciones?: string[] };
      this.logger.log(`analizarCana OK · tokens=${res.usage?.total_tokens ?? '?'}`);
      return {
        resumen: p.resumen ?? 'Sin análisis disponible.',
        alertas: Array.isArray(p.alertas) ? p.alertas : [],
        recomendaciones: Array.isArray(p.recomendaciones) ? p.recomendaciones : [],
      };
    } catch (err) {
      this.logger.error(`analizarCana failed: ${(err as Error).message}`);
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
