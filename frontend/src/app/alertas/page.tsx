'use client';

import Link from 'next/link';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconCheck,
  IconRefresh,
} from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { PasswordGate } from '@/components/ui/PasswordGate';
import { useAlertasConfig } from './_hooks/useAlertasConfig';
import { AvisosConfigPanel } from './_components/AvisosConfigPanel';
import { ThresholdsPanel } from './_components/ThresholdsPanel';

export default function AlertasConfigPage() {
  const {
    loading,
    saving,
    saveOk,
    areaFilter,
    setAreaFilter,
    search,
    setSearch,
    modalEnabled,
    beepEnabled,
    voiceEnabled,
    reload,
    getThreshold,
    update,
    filteredSensors,
    onSave,
    toggleModal,
    toggleBeep,
    toggleVoice,
    stats,
    unlock,
    pwdGateOpen,
    setPwdGateOpen,
    setPendingAction,
    handlePwdSuccess,
  } = useAlertasConfig();

  return (
    <div className="min-h-screen relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,184,0,0.06), transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <Sidebar />
        <TopBar plant="Sala de Monitoreo · Configuración Alertas" />

        <main className="px-3 sm:px-4 py-3 sm:py-4 max-w-[1600px] mx-auto space-y-3 sm:space-y-4">
          {/* Breadcrumb + actions */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs lg:text-sm text-text-muted hover:text-primary-light transition-colors px-3 lg:px-4 py-1.5 lg:py-2.5 rounded-md hover:bg-bg-hover border border-transparent hover:border-border"
            >
              <IconArrowLeft size={14} className="lg:w-5 lg:h-5" />
              Volver al dashboard
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xs mono text-text-muted px-2.5 py-1 rounded-md bg-bg-card/60 border border-border whitespace-nowrap">
                <span className="text-ok font-semibold tabular-nums">{stats.enabled}</span>
                <span className="text-text-muted"> / {stats.total} activos</span>
              </span>
              <button
                onClick={reload}
                className="inline-flex items-center gap-1.5 text-2xs text-text-muted hover:text-primary-light transition-colors px-3 py-1.5 rounded-md hover:bg-bg-hover border border-border"
                title="Recargar"
              >
                <IconRefresh size={13} />
                Recargar
              </button>
              <Link
                href="/alertas/analisis"
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md border-2 border-primary-light/35 text-primary-light hover:bg-bg-hover transition-all"
              >
                Ver análisis e historial →
              </Link>
              <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md border-2 transition-all"
                style={{
                  background: saveOk
                    ? 'rgba(74,184,150,0.14)'
                    : 'rgba(91,155,201,0.12)',
                  borderColor: saveOk ? 'rgba(74,184,150,0.45)' : 'rgba(91,155,201,0.35)',
                  color: saveOk ? '#4ab896' : '#5b9bc9',
                  boxShadow: saveOk
                    ? '0 0 18px rgba(74,184,150,0.28)'
                    : '0 0 14px rgba(91,155,201,0.14)',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saveOk ? <IconCheck size={14} /> : <IconDeviceFloppy size={14} />}
                {saving ? 'Guardando…' : saveOk ? 'Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </header>

          <AvisosConfigPanel
            modalEnabled={modalEnabled}
            beepEnabled={beepEnabled}
            voiceEnabled={voiceEnabled}
            toggleModal={toggleModal}
            toggleBeep={toggleBeep}
            toggleVoice={toggleVoice}
          />

          <ThresholdsPanel
            loading={loading}
            filteredSensors={filteredSensors}
            areaFilter={areaFilter}
            setAreaFilter={setAreaFilter}
            search={search}
            setSearch={setSearch}
            getThreshold={getThreshold}
            update={update}
          />


        </main>
      </div>

      {/* Password gate */}
      <PasswordGate
        isOpen={pwdGateOpen}
        onSuccess={handlePwdSuccess}
        onClose={() => { setPwdGateOpen(false); setPendingAction(null); }}
        unlock={unlock}
        title="Configuración protegida"
        description="Ingresá la contraseña para modificar esta configuración."
      />
      <Footer />
    </div>
  );
}
