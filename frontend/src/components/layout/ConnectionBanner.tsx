'use client';

import { useEffect, useRef, useState } from 'react';
import { IconWifiOff, IconAlertTriangle, IconClockExclamation } from '@tabler/icons-react';
import { AnimatePresence, m } from 'motion/react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { parseServerDate } from '@/lib/utils/format';

const STALE_WARN_SEC = 15;   // > 15s → banner ámbar "demorados"
const STALE_DEAD_SEC = 30;   // > 30s → banner rojo "sensores caídos"
const HEALTH_PING_MS = 10_000;     // ping cada 10s
const HEALTH_FAIL_THRESHOLD = 2;   // 2 fallos consecutivos → marcar offline

type BannerType = 'offline' | 'sensors-dead' | 'sensors-warn' | null;

export function ConnectionBanner() {
  const [navOnline, setNavOnline] = useState(true);
  const [pingOnline, setPingOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const failCountRef = useRef(0);

  const energia = useDashboardData('energia');
  const produccion = useDashboardData('produccion');
  const trapiche = useDashboardData('trapiche');

  // Detectar offline navegador (señal débil en desktop)
  useEffect(() => {
    const setOn = () => setNavOnline(true);
    const setOff = () => setNavOnline(false);
    setNavOnline(navigator.onLine);
    window.addEventListener('online', setOn);
    window.addEventListener('offline', setOff);
    return () => {
      window.removeEventListener('online', setOn);
      window.removeEventListener('offline', setOff);
    };
  }, []);

  // Ping health backend cada 10s (señal fuerte y precisa)
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';
    const ping = async () => {
      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 5_000);
        const res = await fetch(`${apiUrl}/health`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          failCountRef.current = 0;
          setPingOnline(true);
        } else {
          failCountRef.current += 1;
          if (failCountRef.current >= HEALTH_FAIL_THRESHOLD) setPingOnline(false);
        }
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current >= HEALTH_FAIL_THRESHOLD) setPingOnline(false);
      }
    };
    ping();
    const id = setInterval(ping, HEALTH_PING_MS);
    return () => clearInterval(id);
  }, []);

  const online = navOnline && pingOnline;

  // Reevaluar staleness cada 5s (responsive a corte conexión)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  // Último update global entre las 3 áreas
  const allItems = [
    ...Array.from(energia.values()),
    ...Array.from(produccion.values()),
    ...Array.from(trapiche.values()),
  ];

  let mostRecent = 0;
  allItems.forEach((i) => {
    const d = parseServerDate(i.updated_at);
    const t = d ? d.getTime() : 0;
    if (t > mostRecent) mostRecent = t;
  });

  const hasData = allItems.length > 0;
  const ageSec = hasData ? Math.floor((now - mostRecent) / 1000) : Infinity;

  let bannerType: BannerType = null;
  if (!online) bannerType = 'offline';
  else if (hasData && ageSec > STALE_DEAD_SEC) bannerType = 'sensors-dead';
  else if (hasData && ageSec > STALE_WARN_SEC) bannerType = 'sensors-warn';

  const offlineMsg = !navOnline
    ? 'Sin conexión a internet · navegador desconectado'
    : 'Sin conexión al servidor · backend no responde (2+ pings fallidos)';

  const config = {
    offline: {
      icon: <IconWifiOff size={16} />,
      color: 'var(--danger)',
      bg: 'var(--danger-soft)',
      msg: offlineMsg,
    },
    'sensors-dead': {
      icon: <IconAlertTriangle size={16} />,
      color: 'var(--danger)',
      bg: 'var(--danger-soft)',
      msg: `Sensores sin actualizar hace ${ageSec}s · verificar Node-RED o red de planta`,
    },
    'sensors-warn': {
      icon: <IconClockExclamation size={16} />,
      color: 'var(--warn)',
      bg: 'var(--warn-soft)',
      msg: `Última lectura hace ${ageSec}s · datos demorados`,
    },
  };

  return (
    <AnimatePresence>
      {bannerType && (
        <m.div
          key={bannerType}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2 backdrop-blur-md border-b-2"
          style={{
            background: config[bannerType].bg,
            borderBottomColor: config[bannerType].color,
            color: config[bannerType].color,
            boxShadow: '0 4px 24px rgba(0,0,0,0.20)',
          }}
        >
          {config[bannerType].icon}
          <span className="text-xs font-semibold uppercase tracking-wider">
            {config[bannerType].msg}
          </span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
