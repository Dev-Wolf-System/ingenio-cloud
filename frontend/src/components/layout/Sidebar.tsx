'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m, AnimatePresence } from 'motion/react';
import {
  IconLayoutDashboard,
  IconChartBar,
  IconChevronRight,
  IconFlask,
  IconSettings,
  IconUsers,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

interface NavLeaf {
  href: string;
  label: string;
  icon?: TablerIcon;
  section: string;
  adminOnly?: boolean;
}

interface NavParent {
  label: string;
  icon: TablerIcon;
  section: string;
  children: NavLeaf[];
}

const NAV_ITEMS: (NavLeaf | NavParent)[] = [
  { href: '/', label: 'Dashboard', icon: IconLayoutDashboard, section: 'dashboard' },
  {
    label: 'Laboratorio',
    icon: IconFlask,
    section: 'laboratorio',
    children: [
      { href: '/laboratorio/azucar', label: 'Análisis de Azúcar', section: 'laboratorio' },
      { href: '/laboratorio/resumen-fabrica', label: 'Resumen de Fábrica', section: 'laboratorio' },
    ],
  },
  {
    label: 'Configuraciones',
    icon: IconSettings,
    section: 'alertas',
    children: [
      { href: '/alertas', label: 'Alertas', section: 'alertas' },
      { href: '/configuraciones/usuarios', label: 'Usuarios', section: 'alertas', icon: IconUsers, adminOnly: true },
    ],
  },
  { href: '/alertas/analisis', label: 'Análisis', icon: IconChartBar, section: 'analisis' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, allowedSections } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setHint(false);
    }, 300);
  };

  return (
    <>
      {/* Franja de detección — desktop, invisible, borde izquierdo */}
      <div
        className="hidden md:block fixed left-0 top-0 bottom-0 w-3.5 z-40"
        onMouseEnter={() => {
          cancelClose();
          setHint(true);
        }}
        onMouseLeave={scheduleClose}
      />

      {/* Flechita de hint — desktop */}
      <AnimatePresence>
        {hint && !open && (
          <m.button
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={() => {
              cancelClose();
              setOpen(true);
            }}
            onClick={() => setOpen(true)}
            aria-label="Abrir navegación"
            className="hidden md:flex fixed left-1 top-1/2 -translate-y-1/2 z-40 w-7 h-7 rounded-full items-center justify-center bg-bg-card border border-border-strong text-primary-light"
            style={{ boxShadow: '0 0 10px var(--primary-glow)' }}
          >
            <IconChevronRight size={18} />
          </m.button>
        )}
      </AnimatePresence>

      {/* Pestaña fija — mobile/touch, siempre visible (no hay hover), con ícono para que se note */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir navegación"
        className="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 w-5 h-14 rounded-r-lg flex items-center justify-center bg-bg-card border border-border-strong border-l-0 text-primary-light"
        style={{ boxShadow: '0 0 10px var(--primary-glow)' }}
      >
        <IconChevronRight size={14} />
      </button>

      {/* Backdrop — mobile, solo mientras está abierto */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-black/55"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar expandido — desktop overlay con hover, mobile drawer con tap */}
      <AnimatePresence>
        {open && (
          <m.nav
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="fixed left-0 top-0 bottom-0 z-40 w-[190px] flex flex-col border-r border-border"
            style={{
              background: 'var(--header-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '8px 0 24px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header propio — logo + nombre, no depende del scroll del TopBar */}
            <div className="flex items-center gap-2.5 px-3 h-16 border-b border-border shrink-0">
              <div
                className="relative w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden p-1 shrink-0"
                style={{
                  background: 'var(--logo-plate-bg)',
                  boxShadow: '0 0 0 1px var(--logo-plate-ring), 0 2px 8px rgba(0,0,0,0.18)',
                }}
              >
                <Image
                  src="/logo-ingenio-cloud.png"
                  alt="Ingenio Cloud"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <span className="text-sm font-semibold text-text-primary tracking-tight leading-tight">
                Ingenio <span className="text-primary-light">Cloud</span>
              </span>
            </div>

            <div className="flex-1 space-y-1 px-2 py-3">
              {NAV_ITEMS.filter((item) => role === 'admin' || allowedSections.includes(item.section)).map((item) => {
                if ('children' in item) {
                  const Icon = item.icon;
                  const visibleChildren = item.children.filter((c) => !c.adminOnly || role === 'admin');
                  if (visibleChildren.length === 0) return null;
                  const expanded = expandedLabel === item.label;
                  const childActive = visibleChildren.some((c) => pathname === c.href);
                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        onClick={() => setExpandedLabel((v) => (v === item.label ? null : item.label))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          childActive ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <Icon size={16} />
                        {item.label}
                        <IconChevronRight
                          size={12}
                          className="ml-auto transition-transform"
                          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', color: expanded ? 'var(--primary)' : undefined }}
                        />
                      </button>
                      {expanded && (
                        <div className="pl-6 space-y-0.5">
                          {visibleChildren.map((child) => {
                            const active = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors ${
                                  active ? 'text-primary-light' : 'text-text-muted hover:text-text-primary'
                                }`}
                              >
                                {child.icon && <child.icon size={12} />}
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                const { href, label, icon: Icon } = item;
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      active ? 'text-text-primary bg-primary-soft' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-primary"
                        style={{ boxShadow: '0 0 6px var(--primary)' }}
                      />
                    )}
                    {Icon && <Icon size={16} />}
                    {label}
                  </Link>
                );
              })}
            </div>
            <div className="text-2xs text-text-muted px-3 pt-2 mt-2 border-t border-border">
              Ingenio Cloud · v2.0
            </div>
          </m.nav>
        )}
      </AnimatePresence>
    </>
  );
}
