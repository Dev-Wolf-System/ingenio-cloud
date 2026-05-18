'use client';

import { useEffect, useState } from 'react';
import { IconWifiOff, IconAlertTriangle } from '@tabler/icons-react';
import { AnimatePresence, m } from 'motion/react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

const STALE_DEAD_SEC = 180; // 3 min sin updates → todos los sensores caídos

export function ConnectionBanner() {
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const energia = useDashboardData('energia');
  const produccion = useDashboardData('produccion');
  const trapiche = useDashboardData('trapiche');

  // Detectar offline navegador
  useEffect(() => {
    const setOn = () => setOnline(true);
    const setOff = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', setOn);
    window.addEventListener('offline', setOff);
    return () => {
      window.removeEventListener('online', setOn);
      window.removeEventListener('offline', setOff);
    };
  }, []);

  // Reevaluar staleness cada 15s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
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
    const t = new Date(i.updated_at).getTime();
    if (t > mostRecent) mostRecent = t;
  });

  const hasData = allItems.length > 0;
  const ageSec = hasData ? (now - mostRecent) / 1000 : Infinity;
  const allSensorsDown = hasData && ageSec > STALE_DEAD_SEC;

  const show = !online || allSensorsDown;
  const type = !online ? 'offline' : 'sensors-down';

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2 backdrop-blur-md"
          style={{
            background:
              type === 'offline'
                ? 'rgba(217,101,112,0.18)'
                : 'rgba(217,160,74,0.18)',
            borderBottom: `1px solid ${type === 'offline' ? 'rgba(217,101,112,0.5)' : 'rgba(217,160,74,0.5)'}`,
            color: type === 'offline' ? '#d96570' : '#d9a04a',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {type === 'offline' ? <IconWifiOff size={16} /> : <IconAlertTriangle size={16} />}
          <span className="text-xs font-semibold uppercase tracking-wider">
            {type === 'offline'
              ? 'Sin conexión a internet · datos pueden estar desactualizados'
              : `Sin actualizaciones de sensores hace ${Math.round(ageSec)}s · verificar Node-RED`}
          </span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
