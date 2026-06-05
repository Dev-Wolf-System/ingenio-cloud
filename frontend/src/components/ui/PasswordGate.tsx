'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconLock, IconEye, IconEyeOff, IconX } from '@tabler/icons-react';

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
  unlock: (pwd: string) => Promise<boolean> | boolean;
  title?: string;
  description?: string;
}

export function PasswordGate({
  isOpen,
  onSuccess,
  onClose,
  unlock,
  title = 'Acción protegida',
  description = 'Ingresá la contraseña de configuración para continuar.',
}: Props) {
  const [value, setValue] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    const ok = await unlock(value);
    setChecking(false);
    if (ok) {
      setValue('');
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClose = () => {
    setValue('');
    setError(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pwd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            key="pwd-modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#0F1623] overflow-hidden"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(124,106,250,0.08)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <IconLock size={15} className="text-primary-light" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-[11px] text-gray-500">{description}</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <IconX size={15} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      autoFocus
                      autoComplete="current-password"
                      type={showPwd ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => { setValue(e.target.value); setError(false); }}
                      placeholder="••••••••"
                      disabled={checking}
                      className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors pr-10 disabled:opacity-50
                        ${error
                          ? 'border-red-500/60 focus:border-red-500'
                          : 'border-white/10 focus:border-primary/50'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPwd ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                    </button>
                  </div>
                  {error && (
                    <p className="text-[11px] text-red-400 mt-1.5">Contraseña incorrecta. Intentá de nuevo.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!value || checking}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary/80 hover:bg-primary text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {checking ? 'Verificando…' : 'Desbloquear'}
                  </button>
                </div>

                <p className="text-[10px] text-gray-600 text-center">
                  Sesión desbloqueada por 30 min tras ingresar correctamente
                </p>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
