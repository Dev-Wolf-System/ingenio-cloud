'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Maneja orden custom de tiles por grupo, persistido en localStorage.
 * - currentKeys: keys actuales del backend (orden por defecto)
 * - Devuelve el orden final aplicando override del usuario y removiendo
 *   keys obsoletas
 */
export function useTileOrder(group: string, currentKeys: string[]) {
  const storageKey = `ingcloud:tile-order:${group}`;
  const [override, setOverride] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setOverride(JSON.parse(raw) as string[]);
    } catch {
      // noop
    }
  }, [storageKey]);

  const saveOrder = useCallback(
    (next: string[]) => {
      setOverride(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // noop
      }
    },
    [storageKey],
  );

  // Aplicar override + agregar keys nuevas al final + descartar obsoletas
  const ordered: string[] = (() => {
    if (override.length === 0) return currentKeys;
    const set = new Set(currentKeys);
    const result: string[] = [];
    override.forEach((k) => {
      if (set.has(k)) {
        result.push(k);
        set.delete(k);
      }
    });
    // Agregar keys nuevas al final (no estaban en override)
    set.forEach((k) => result.push(k));
    return result;
  })();

  return { ordered, saveOrder };
}
