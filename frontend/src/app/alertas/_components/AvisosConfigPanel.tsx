'use client';

import {
  IconBell,
  IconBellOff,
  IconVolume,
  IconVolumeOff,
  IconWindowMaximize,
  IconWindowMinimize,
  IconSettings,
} from '@tabler/icons-react';
import { PremiumPanel } from '@/components/industrial/PremiumPanel';
import { Toggle } from './shared';

interface AvisosConfigPanelProps {
  modalEnabled: boolean;
  beepEnabled: boolean;
  voiceEnabled: boolean;
  toggleModal: () => void;
  toggleBeep: () => void;
  toggleVoice: () => void;
}

export function AvisosConfigPanel({
  modalEnabled,
  beepEnabled,
  voiceEnabled,
  toggleModal,
  toggleBeep,
  toggleVoice,
}: AvisosConfigPanelProps) {
  return (
    <PremiumPanel
      title="CONFIGURACIÓN DE AVISOS"
      subtitle="Modal automático · Beep · Voz IA · requieren contraseña para modificar"
      icon={<IconSettings size={18} className="text-primary-light" />}
      accent="primary"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1">
        {/* Toggle: Modal automático */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2.5">
            {modalEnabled
              ? <IconWindowMaximize size={17} className="text-primary-light flex-shrink-0" />
              : <IconWindowMinimize size={17} className="text-gray-600 flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-white">Modal automático</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                {modalEnabled ? 'Activo — se abre al detectar alerta' : 'Desactivado'}
              </p>
            </div>
          </div>
          <Toggle enabled={modalEnabled} onChange={toggleModal} />
        </div>

        {/* Toggle: Beep */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2.5">
            {beepEnabled
              ? <IconBell size={17} className="text-warn flex-shrink-0" />
              : <IconBellOff size={17} className="text-gray-600 flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-white">Beep de alerta</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                {beepEnabled ? 'Activo — suena al detectar' : 'Desactivado'}
              </p>
            </div>
          </div>
          <Toggle enabled={beepEnabled} onChange={toggleBeep} />
        </div>

        {/* Toggle: Voz */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2.5">
            {voiceEnabled
              ? <IconVolume size={17} className="text-ok flex-shrink-0" />
              : <IconVolumeOff size={17} className="text-gray-600 flex-shrink-0" />}
            <div>
              <p className="text-sm font-medium text-white">Voz IA (OpenAI TTS)</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                {voiceEnabled ? 'Activa — genera audio por alerta' : 'Desactivada · sin costo API'}
              </p>
            </div>
          </div>
          <Toggle enabled={voiceEnabled} onChange={toggleVoice} />
        </div>
      </div>
    </PremiumPanel>
  );
}
