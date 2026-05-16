import { IconRobot } from '@tabler/icons-react';

export function CopilotBanner() {
  return (
    <div className="border-t border-border bg-bg-surface/80 backdrop-blur px-4 h-20 flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary-soft text-primary-light">
        <IconRobot size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted uppercase tracking-wide">Copiloto Vigía</div>
        <p className="text-sm text-text-secondary truncate">
          Sistema proactivo de detección y diagnóstico — disponible en Sprint 1
          (detección anomalías + predicción fallos + diagnóstico LLM + sugerencias acción).
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-bg-hover transition-colors text-text-muted"
          disabled
        >
          Ver detalles
        </button>
      </div>
    </div>
  );
}
