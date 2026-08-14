'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { m, AnimatePresence } from 'motion/react';
import { IconAlertCircle, IconLoader2, IconEye, IconEyeOff } from '@tabler/icons-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { Footer } from '@/components/layout/Footer';

// Red de sensores animada — grilla de nodos (x/y en % de pantalla completa)
const NODES = [
  { x: 8, y: 12, hub: true, delay: 0 },
  { x: 22, y: 28, hub: false, delay: -0.4 },
  { x: 14, y: 52, hub: false, delay: -1.1 },
  { x: 33, y: 64, hub: false, delay: -0.7 },
  { x: 6, y: 78, hub: false, delay: -1.6 },
  { x: 44, y: 18, hub: true, delay: -0.3 },
  { x: 58, y: 34, hub: false, delay: -1.9 },
  { x: 50, y: 52, hub: false, delay: -0.9 },
  { x: 38, y: 86, hub: false, delay: -1.3 },
  { x: 64, y: 72, hub: false, delay: -0.5 },
  { x: 76, y: 20, hub: true, delay: -1.7 },
  { x: 82, y: 44, hub: false, delay: -0.2 },
  { x: 70, y: 58, hub: false, delay: -1.4 },
  { x: 88, y: 66, hub: false, delay: -0.8 },
  { x: 92, y: 84, hub: false, delay: -1.1 },
  { x: 56, y: 88, hub: false, delay: -0.6 },
  { x: 26, y: 8, hub: false, delay: -1.5 },
  { x: 96, y: 10, hub: false, delay: -0.3 },
] as const;

// Pares de índices en NODES que se conectan
const EDGES: [number, number][] = [
  [0, 1], [0, 16], [1, 2], [1, 5], [2, 3], [2, 4], [3, 7], [3, 8], [4, 8],
  [5, 6], [5, 16], [6, 7], [6, 10], [7, 9], [7, 12], [8, 15], [9, 12],
  [9, 13], [10, 11], [10, 17], [11, 12], [11, 13], [12, 15], [13, 14], [14, 15],
];

// Subconjunto de EDGES por los que "viaja" un pulso de dato
const PULSE_EDGES: [number, number][] = [[0, 1], [6, 7], [10, 11], [12, 15]];

// Nodos hub que emiten un ping de señal
const HUB_INDICES = NODES.reduce<number[]>((acc, n, i) => (n.hub ? [...acc, i] : acc), []);

function SensorNetworkBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: 'var(--bg-base, #12151c)' }}>
      {/* Textura de puntos */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.35,
        }}
      />

      {/* Blobs atmosféricos */}
      <m.div
        className="absolute rounded-full"
        style={{
          width: 320, height: 320, top: '-8%', left: '-6%',
          background: 'radial-gradient(circle, var(--primary-glow), transparent 70%)',
          filter: 'blur(50px)', opacity: 0.55,
        }}
        animate={{ x: [0, 50, 0], y: [0, 35, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <m.div
        className="absolute rounded-full"
        style={{
          width: 280, height: 280, bottom: '-8%', right: '-4%',
          background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)',
          filter: 'blur(50px)', opacity: 0.45,
        }}
        animate={{ x: [0, -45, 0], y: [0, -35, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <m.div
        className="absolute rounded-full"
        style={{
          width: 220, height: 220, bottom: '5%', left: '18%',
          background: 'radial-gradient(circle, var(--primary-glow), transparent 70%)',
          filter: 'blur(46px)', opacity: 0.3,
        }}
        animate={{ x: [0, 30, 0], y: [0, -25, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Líneas de la red */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {EDGES.map(([a, b], i) => {
          const na = NODES[a];
          const nb = NODES[b];
          return (
            <m.line
              key={i}
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke="var(--primary-light)"
              strokeWidth="0.12"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.22 }}
              transition={{ duration: 1.4, delay: 0.3 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}
      </svg>

      {/* Nodos */}
      {NODES.map((n, i) => (
        <m.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: `${n.y}%`, left: `${n.x}%`,
            width: n.hub ? 7 : 3.5, height: n.hub ? 7 : 3.5,
            background: n.hub ? 'var(--primary-light)' : 'var(--text-secondary)',
            boxShadow: n.hub ? '0 0 10px var(--primary-glow)' : undefined,
          }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [1, n.hub ? 1.6 : 2.2, 1] }}
          transition={{ duration: n.hub ? 2.6 : 2, repeat: Infinity, ease: 'easeInOut', delay: n.delay }}
        />
      ))}

      {/* Pings de señal — solo nodos hub */}
      {HUB_INDICES.map((idx, i) => {
        const n = NODES[idx];
        return (
          <m.div
            key={idx}
            className="absolute rounded-full"
            style={{ top: `${n.y}%`, left: `${n.x}%`, width: 26, height: 26, marginTop: -13, marginLeft: -13, border: '1px solid var(--primary-light)' }}
            animate={{ scale: [0.4, 2.6], opacity: [0.55, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: i * 1 }}
          />
        );
      })}

      {/* Pulsos de datos viajando por la red */}
      {PULSE_EDGES.map(([a, b], i) => {
        const na = NODES[a];
        const nb = NODES[b];
        return (
          <m.div
            key={i}
            className="absolute rounded-full"
            style={{ width: 3, height: 3, marginTop: -1.5, marginLeft: -1.5, background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
            animate={{
              top: [`${na.y}%`, `${nb.y}%`],
              left: [`${na.x}%`, `${nb.x}%`],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'linear', delay: i * 1.4, repeatDelay: 0.6 }}
          />
        );
      })}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--bg-surface)' }}>
    <SensorNetworkBackground />
    <div className="flex-1 flex min-h-0 relative z-10">
      {/* Panel branding — oculto en mobile */}
      <div className="hidden md:flex flex-1 relative flex-col items-center justify-center px-10 text-center overflow-hidden">
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-col items-center"
        >
          <m.div
            className="w-[96px] h-[96px] rounded-2xl flex items-center justify-center mb-5 p-2.5"
            style={{ background: 'var(--logo-plate-bg)', border: '1px solid var(--logo-plate-ring)' }}
            animate={{
              boxShadow: ['0 0 36px var(--primary-glow)', '0 0 64px var(--primary-glow)', '0 0 36px var(--primary-glow)'],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Image src="/logo-ingenio-cloud.png" alt="Ingenio Cloud" width={72} height={72} className="object-contain" priority />
          </m.div>
          <h1 className="text-[28px] font-bold tracking-tight mb-3.5" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Ingenio <span style={{ color: 'var(--primary-light)' }}>Cloud</span>
          </h1>
          <p className="text-lg max-w-[340px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial
          </p>
        </m.div>
      </div>

      {/* Panel form */}
      <div className="flex-1 flex items-center justify-center px-6 py-6 overflow-y-auto">
        <m.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[320px]"
        >
          {/* Branding compacto — solo mobile */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex md:hidden flex-col items-center text-center mb-7"
          >
            <m.div
              className="w-[76px] h-[76px] rounded-2xl flex items-center justify-center mb-3 p-2"
              style={{ background: 'var(--logo-plate-bg)', border: '1px solid var(--logo-plate-ring)' }}
              animate={{
                boxShadow: ['0 0 24px var(--primary-glow)', '0 0 44px var(--primary-glow)', '0 0 24px var(--primary-glow)'],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image src="/logo-ingenio-cloud.png" alt="Ingenio Cloud" width={58} height={58} className="object-contain" priority />
            </m.div>
            <h1 className="text-xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Ingenio <span style={{ color: 'var(--primary-light)' }}>Cloud</span>
            </h1>
            <p className="text-base max-w-[280px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial
            </p>
          </m.div>

          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Iniciar sesión
          </h2>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            Ingresá tus credenciales para acceder
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-shadow"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                placeholder="operador@ingeniolacorona.com"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-lg pl-3 pr-10 text-sm outline-none transition-shadow"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
                >
                  <IconAlertCircle size={14} />
                  {error}
                </m.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: '#fff',
                boxShadow: '0 4px 20px var(--primary-glow)',
              }}
            >
              {loading && <IconLoader2 size={15} className="animate-spin" />}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </m.div>
      </div>
    </div>
    <Footer />
    </div>
  );
}
