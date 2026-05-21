export function formatNumber(value: number, precision = 1): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
}

/**
 * Parsea un timestamp del backend de forma segura.
 * Si el string NO trae offset/Z, lo trata como UTC (Postgres timestamptz
 * se almacena UTC; un timestamp sin TZ sería interpretado como hora local
 * del browser → desfase). Devuelve Date inválido si no parsea.
 */
export function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  let s = value.trim();
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  if (!hasZone) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hora HH:MM en zona ART desde un timestamp del backend */
export function formatHoraAR(value?: string | null): string {
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? (parseServerDate(date) ?? new Date(date)) : date;
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}
