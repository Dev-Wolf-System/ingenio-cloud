'use client';

import { IconSun, IconMoon } from '@tabler/icons-react';
import { m, AnimatePresence } from 'motion/react';
import { useTheme } from '@/lib/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();

  return (
    <button
      onClick={toggle}
      className="relative p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-primary-light"
      aria-label="Cambiar tema claro/oscuro"
      title={mounted ? `Tema: ${theme === 'dark' ? 'oscuro' : 'claro'} (click para cambiar)` : 'Cambiar tema'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={mounted ? theme : 'idle'}
          initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="block"
        >
          {mounted && theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
        </m.span>
      </AnimatePresence>
    </button>
  );
}
