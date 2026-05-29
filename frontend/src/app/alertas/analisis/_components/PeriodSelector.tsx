'use client';

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { Periodo } from '../_types';
import { C } from './chart-kit';

const OPTIONS: { value: Periodo; label: string }[] = [
  { value: 'turno', label: 'Turno' },
  { value: 'dia',   label: 'Día'   },
  { value: 'zafra', label: 'Zafra' },
];

interface PeriodSelectorProps {
  periodo: Periodo;
  offset: number;
  onPeriodo: (p: Periodo) => void;
  onStepBack: () => void;
  onStepForward: () => void;
  etiqueta: string;
}

export function PeriodSelector({
  periodo,
  offset,
  onPeriodo,
  onStepBack,
  onStepForward,
  etiqueta,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Segmented pill group */}
      <div
        className="inline-flex items-center rounded-xl p-1 gap-1"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          backdropFilter: 'blur(16px)',
        }}
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === periodo;
          return (
            <button
              key={opt.value}
              onClick={() => onPeriodo(opt.value)}
              className="relative px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200"
              style={{
                color:      active ? '#F0F4FF' : C.muted,
                background: active ? 'rgba(0,212,255,0.18)' : 'transparent',
                border:     active ? `1px solid rgba(0,212,255,0.40)` : '1px solid transparent',
                boxShadow:  active ? '0 0 14px rgba(0,212,255,0.25)' : 'none',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Stepper — hidden for zafra */}
      {periodo !== 'zafra' && (
        <div
          className="inline-flex items-center gap-1 rounded-xl px-1 py-1"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            backdropFilter: 'blur(16px)',
          }}
        >
          <button
            onClick={onStepBack}
            disabled={offset >= 30}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{
              color:      offset >= 30 ? 'rgba(107,122,158,0.35)' : C.muted,
              background: 'transparent',
              cursor:     offset >= 30 ? 'not-allowed' : 'pointer',
            }}
            title="Período anterior"
          >
            <IconChevronLeft size={15} />
          </button>

          <span
            className="px-3 py-1 text-xs font-semibold tabular-nums min-w-[110px] text-center"
            style={{ color: offset === 0 ? C.cyan : '#F0F4FF' }}
          >
            {etiqueta}
          </span>

          <button
            onClick={onStepForward}
            disabled={offset === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{
              color:      offset === 0 ? 'rgba(107,122,158,0.35)' : C.muted,
              background: 'transparent',
              cursor:     offset === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Período siguiente"
          >
            <IconChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
