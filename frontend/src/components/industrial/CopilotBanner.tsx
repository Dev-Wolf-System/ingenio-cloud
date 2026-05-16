import { IconRobot, IconSparkles } from '@tabler/icons-react';

export function CopilotBanner() {
  return (
    <div
      className="relative border-t border-border px-5 h-20 flex items-center gap-4 overflow-hidden"
      style={{
        background:
          'linear-gradient(90deg, rgba(46,122,181,0.08), rgba(79,191,229,0.04) 50%, transparent), var(--bg-surface)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Glow accent */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(circle at 10% 50%, rgba(74,156,216,0.15), transparent 40%)',
        }}
      />

      <div className="relative flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow ring-1 ring-primary-light/30">
          <IconRobot size={22} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm font-semibold text-text-primary tracking-tight inline-flex items-center gap-1.5">
            Copiloto Vigía
            <span className="inline-flex items-center gap-1 text-2xs uppercase tracking-wider font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full border border-accent/30">
              <IconSparkles size={10} />
              IA activa
            </span>
          </span>
          <span className="text-2xs text-text-muted">
            Análisis automático de turnos · detección proactiva próxima
          </span>
        </div>
      </div>

      <div className="ml-auto relative flex items-center gap-3 text-2xs text-text-muted">
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="text-text-secondary font-medium">Sprint 1 — Vigía Mesh</span>
          <span>Anomaly · Predictor · Diagnóstico · Prescriptor</span>
        </div>
      </div>
    </div>
  );
}
