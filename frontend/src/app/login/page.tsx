'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { m, AnimatePresence } from 'motion/react';
import { IconAlertCircle, IconLoader2 } from '@tabler/icons-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

const NODES = [
  { top: '16%', left: '15%', delay: 0 },
  { top: '34%', left: '35%', delay: -0.5 },
  { top: '52%', left: '22%', delay: -1 },
  { top: '41%', left: '58%', delay: -1.5 },
  { top: '27%', left: '75%', delay: -2 },
  { top: '70%', left: '40%', delay: -0.8 },
  { top: '77%', left: '65%', delay: -1.3 },
  { top: '59%', left: '78%', delay: -2.2 },
];

const LINES = [
  'M 60,70 L 140,150',
  'M 140,150 L 90,230',
  'M 140,150 L 230,180',
  'M 230,180 L 300,120',
  'M 90,230 L 160,310',
  'M 160,310 L 260,340',
  'M 230,180 L 310,260',
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen flex" style={{ background: 'var(--bg-surface)' }}>
      {/* Panel branding — oculto en mobile */}
      <div
        className="hidden md:flex flex-1 relative flex-col items-center justify-center px-10 text-center overflow-hidden"
        style={{ background: 'var(--bg-base, #12151c)' }}
      >
        <m.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 280,
            height: 280,
            top: -60,
            left: -40,
            background: 'radial-gradient(circle, var(--primary-glow), transparent 70%)',
            filter: 'blur(44px)',
            opacity: 0.5,
          }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <m.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 240,
            height: 240,
            bottom: -50,
            right: -30,
            background: 'radial-gradient(circle, var(--accent-glow), transparent 70%)',
            filter: 'blur(44px)',
            opacity: 0.4,
          }}
          animate={{ x: [0, -25, 0], y: [0, -20, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        />

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 440" preserveAspectRatio="none">
          {LINES.map((d, i) => (
            <path key={i} d={d} stroke="var(--primary-light)" strokeWidth="1" fill="none" opacity="0.25" />
          ))}
        </svg>
        {NODES.map((n, i) => (
          <m.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{ top: n.top, left: n.left, width: 4, height: 4, background: 'var(--primary-light)' }}
            animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.8, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: n.delay }}
          />
        ))}

        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-col items-center"
        >
          <m.div
            className="w-[76px] h-[76px] rounded-2xl flex items-center justify-center mb-5 p-2"
            style={{ background: 'var(--logo-plate-bg)', border: '1px solid var(--logo-plate-ring)' }}
            animate={{ boxShadow: ['0 0 40px var(--primary-glow)', '0 0 56px var(--primary-glow)', '0 0 40px var(--primary-glow)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Image src="/logo-ingenio-cloud.png" alt="Ingenio Cloud" width={56} height={56} className="object-contain" priority />
          </m.div>
          <h1 className="text-[28px] font-bold tracking-tight mb-3.5" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Ingenio <span style={{ color: 'var(--primary-light)' }}>Cloud</span>
          </h1>
          <p className="text-sm max-w-[340px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Plataforma Inteligente de Monitoreo, Producción y Asistencia Operativa Industrial
          </p>
        </m.div>
      </div>

      {/* Panel form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <m.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[320px]"
        >
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
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-shadow"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                placeholder="••••••••••"
              />
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
  );
}
