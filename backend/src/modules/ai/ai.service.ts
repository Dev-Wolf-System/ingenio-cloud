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
    turno_anterior: string;
    desde: string;
    hasta: string;
    paradasFabrica: Record<string, unknown>;
    moliendaPromedio: Record<string, unknown>;
    consumoGas: Record<string, unknown>;
  }): Promise<{
    resumen: string;
    estado: 'normal' | 'atencion' | 'critico';
    puntos_clave: string[];
  } | null> {
    if (!this.client) return null;

    const systemPrompt = `Sos un ingeniero senior experto en ingenios azucareros (Ingenio La Corona, Tucumán Argentina).
Análisis turno operativo en base a 3 KPIs:
- Paradas de fábrica (cantidad, tiempo neto)
- Molienda promedio (kg/h, totales)
- Consumo de gas (m³/h, total)

Tu trabajo: dar un comentario operativo profesional, claro y conciso para gerentes/jefes turno.
Tono: directo, técnico, en español rioplatense.
Salida JSON estricto con campos: resumen (string 2-3 oraciones), estado (normal|atencion|critico), puntos_clave (array 2-4 bullets cortos).`;

    const userPrompt = `Turno: ${payload.turno_anterior}
Periodo: ${payload.desde} → ${payload.hasta}

Paradas:
${JSON.stringify(payload.paradasFabrica, null, 2)}

Molienda:
${JSON.stringify(payload.moliendaPromedio, null, 2)}

Consumo gas:
${JSON.stringify(payload.consumoGas, null, 2)}

Analizá el desempeño del turno.`;

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const content = res.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as {
        resumen?: string;
        estado?: 'normal' | 'atencion' | 'critico';
        puntos_clave?: string[];
      };
      this.logger.log(
        `LLM análisis OK (tokens=${res.usage?.total_tokens ?? '?'} estado=${parsed.estado})`,
      );
      return {
        resumen: parsed.resumen ?? 'Sin análisis disponible.',
        estado: parsed.estado ?? 'normal',
        puntos_clave: parsed.puntos_clave ?? [],
      };
    } catch (err) {
      this.logger.error('OpenAI analyze failed', err as Error);
      return null;
    }
  }
}
