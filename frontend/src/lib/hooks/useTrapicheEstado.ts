import { useEffect, useMemo, useState } from 'react';
import type { DashboardItem } from './useDashboardData';

export type EstadoTrapiche = 'funcionando' | 'parado';

const ESTADO_KEYS = ['trapiche_estado', 'estado', 'estado_trapiche', 'status'];
const VAPOR_VG1_KEY_PATTERNS = ['presion_vapor_vg1', 'vapor_vg1', 'p_vapor_vg1'];
const VAPOR_VG1_THRESHOLD = 1.9; // Vg1 > 1.9 (Kg/cm² ≈ Bar) ⇒ Funcionamiento
const DEBOUNCE_MS = 10_000; // evita falsos banners por glitch puntual del sensor

function pickItem(map: Map<string, DashboardItem>, candidates: string[]): DashboardItem | null {
  const entries = Array.from(map.entries());
  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    for (const [key, item] of entries) {
      if (key.toLowerCase() === lower) return item;
    }
  }
  return null;
}

function parseEstadoExplicit(item: DashboardItem | null): EstadoTrapiche | null {
  if (!item) return null;
  if (typeof item.value === 'number') {
    if (item.value === 1) return 'funcionando';
    if (item.value === 0) return 'parado';
  }
  const s = (item.display ?? '').toString().toLowerCase();
  if (s.includes('func') || s === 'on' || s === 'true' || s === '1') return 'funcionando';
  if (s.includes('par') || s === 'off' || s === 'false' || s === '0') return 'parado';
  return null;
}

function deriveEstadoFromVaporVg1(energia: Map<string, DashboardItem>): EstadoTrapiche | null {
  const entries = Array.from(energia.entries());
  for (const pattern of VAPOR_VG1_KEY_PATTERNS) {
    for (const [k, item] of entries) {
      if (k.toLowerCase().includes(pattern)) {
        return item.value > VAPOR_VG1_THRESHOLD ? 'funcionando' : 'parado';
      }
    }
  }
  return null;
}

/**
 * Estado del trapiche con debounce simétrico de 10s: el cambio de estado
 * (en cualquier dirección) solo se confirma si se sostiene 10s seguidos.
 * Si el valor crudo vuelve al estado anterior antes de esos 10s, se cancela
 * el cambio — evita que el banner parpadee por un glitch puntual del sensor.
 */
export function useTrapicheEstado(
  trapiche: Map<string, DashboardItem>,
  energia: Map<string, DashboardItem>,
): EstadoTrapiche {
  const rawEstado = useMemo<EstadoTrapiche>(() => {
    const explicit = parseEstadoExplicit(pickItem(trapiche, ESTADO_KEYS));
    if (explicit) return explicit;
    const derived = deriveEstadoFromVaporVg1(energia);
    if (derived) return derived;
    return 'parado';
  }, [trapiche, energia]);

  const [estado, setEstado] = useState<EstadoTrapiche>(rawEstado);

  useEffect(() => {
    if (rawEstado === estado) return;
    const timer = setTimeout(() => setEstado(rawEstado), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawEstado, estado]);

  return estado;
}
