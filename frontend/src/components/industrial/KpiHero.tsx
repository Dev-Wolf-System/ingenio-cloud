'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IconScale,
  IconChartBar,
  IconFlame,
  IconAlertTriangle,
  IconTruck,
  IconWaveSine,
  IconPlayerPause,
} from '@tabler/icons-react';
import { useDashboardData, type DashboardItem } from '@/lib/hooks/useDashboardData';
import { useParadasMC } from '@/lib/hooks/useParadasMC';
import { formatHoraAR } from '@/lib/utils/format';
import { PremiumTile } from './PremiumTile';
import { MoliendaEstadoModal, type MoliendaBloquesPayload } from './MoliendaEstadoModal';
import { GasEstadoModal, type GasBloquesPayload, type GasHoraEnCurso, mergeGasHoraEnCurso } from './GasEstadoModal';
import { AlertasModalAuto, type ActiveAlert } from './AlertasModalAuto';
import { CanchonModal } from './CanchonModal';
import { ParadasModal } from './ParadasModal';
import { AlertasListModal } from './AlertasListModal';

async function fetchAlerts() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/alerts/active`);
  if (!res.ok) return { alerts: [] };
  return res.json();
}

async function fetchCanchon() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/metrics/canchon`);
  if (!res.ok) return { total_camiones: null as number | null };
  return res.json() as Promise<{ total_camiones: number | null }>;
}

async function fetchBolsasDia() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/metrics/bolsas-dia`);
  if (!res.ok) return { total_bolsas: null, horas_cargadas: null, ultima_hora: null, fecha_industrial: null };
  return res.json() as Promise<{
    total_bolsas: number | null;
    horas_cargadas: number | null;
    ultima_hora: string | null;
    fecha_industrial: string | null;
  }>;
}

async function fetchMoliendaActual() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/molienda-actual`);
  if (!res.ok) return { molienda_kg: null, acumulado_kg: null, etiqueta: null };
  return res.json() as Promise<{
    molienda_kg: number | null;
    acumulado_kg: number | null;
    etiqueta: string | null;
  }>;
}

async function fetchMoliendaBloques(): Promise<MoliendaBloquesPayload> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/molienda-bloques`);
  if (!res.ok) return {};
  return res.json();
}

async function fetchGasActual() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/gas-actual`);
  if (!res.ok) return { gas_m3: null, acumulado_turno_m3: null, acumulado_dia_m3: null, etiqueta: null };
  return res.json() as Promise<{
    gas_m3: number | null;
    acumulado_turno_m3: number | null;
    acumulado_dia_m3: number | null;
    etiqueta: string | null;
    hora: string | null;
  }>;
}

async function fetchGasBloques(): Promise<GasBloquesPayload> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/gas-bloques`);
  if (!res.ok) return {};
  return res.json();
}

async function fetchGasHoraEnCurso(): Promise<GasHoraEnCurso | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/guardia/gas-hora-curso`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchColorCintaLarga() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
  const res = await fetch(`${apiUrl}/metrics/color-cinta-larga`);
  if (!res.ok) return { color_icumsa: null, humedad: null, hora_lectura: null };
  return res.json() as Promise<{
    color_icumsa: number | null;
    humedad: number | null;
    hora_lectura: string | null;
  }>;
}

function sumKeysIncluding(map: Map<string, DashboardItem>, patterns: string[]): number | null {
  const entries = Array.from(map.entries());
  let total = 0;
  let found = false;
  for (const [k, item] of entries) {
    const kl = k.toLowerCase();
    if (patterns.some((p) => kl.includes(p.toLowerCase()))) {
      if (Number.isFinite(item.value)) {
        total += item.value;
        found = true;
      }
    }
  }
  return found ? total : null;
}

const HERO_KEYS = ['molienda', 'bolsas', 'gas', 'color', 'camiones', 'paradas'] as const;

export function KpiHero() {
  const energia = useDashboardData('energia');
  const alerts = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: fetchAlerts,
    refetchInterval: 30_000,
  });
  const canchon = useQuery({
    queryKey: ['canchon', 'resumen'],
    queryFn: fetchCanchon,
    refetchInterval: 30_000,
  });
  const colorCinta = useQuery({
    queryKey: ['color', 'cinta-larga'],
    queryFn: fetchColorCintaLarga,
    refetchInterval: 600_000,
  });
  const molienda = useQuery({
    queryKey: ['guardia', 'molienda-actual'],
    queryFn: fetchMoliendaActual,
    refetchInterval: 60_000,
  });
  const bolsas = useQuery({
    queryKey: ['metrics', 'bolsas-dia'],
    queryFn: fetchBolsasDia,
    refetchInterval: 5 * 60_000,
  });
  const [moliendaModalOpen, setMoliendaModalOpen] = useState(false);
  const [gasModalOpen, setGasModalOpen] = useState(false);
  const [canchonModalOpen, setCanchonModalOpen] = useState(false);
  const [paradasModalOpen, setParadasModalOpen] = useState(false);
  const [alertasListOpen, setAlertasListOpen] = useState(false);
  const paradasMC = useParadasMC();
  const moliendaBloques = useQuery({
    queryKey: ['guardia', 'molienda-bloques'],
    queryFn: fetchMoliendaBloques,
    enabled: moliendaModalOpen,
    refetchInterval: moliendaModalOpen ? 30_000 : false,
    staleTime: 30_000,
  });
  const gasActual = useQuery({
    queryKey: ['guardia', 'gas-actual'],
    queryFn: fetchGasActual,
    refetchInterval: 60_000,
  });
  const gasBloques = useQuery({
    queryKey: ['guardia', 'gas-bloques'],
    queryFn: fetchGasBloques,
    enabled: gasModalOpen,
    refetchInterval: gasModalOpen ? 30_000 : false,
    staleTime: 30_000,
  });
  const gasHoraCurso = useQuery({
    queryKey: ['guardia', 'gas-hora-curso'],
    queryFn: fetchGasHoraEnCurso,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
  const gasBloquesConCurso = useMemo(
    () => mergeGasHoraEnCurso(gasBloques.data, gasHoraCurso.data ?? null),
    [gasBloques.data, gasHoraCurso.data],
  );
  const moliendaKg = molienda.data?.molienda_kg ?? null;
  const moliendaHora = molienda.data?.etiqueta ?? null;
  const moliendaAcum = molienda.data?.acumulado_kg ?? null;
  const bolsasTotal = bolsas.data?.total_bolsas ?? null;
  const bolsasHoras = bolsas.data?.horas_cargadas ?? null;
  const bolsasUltima = bolsas.data?.ultima_hora ?? null;
  const gasTotal = sumKeysIncluding(energia, ['caudal_gas']);
  const totalCamiones = canchon.data?.total_camiones ?? null;
  const colorIcumsa = colorCinta.data?.color_icumsa ?? null;
  const humedadCinta = colorCinta.data?.humedad ?? null;
  const horaLectura = colorCinta.data?.hora_lectura ?? null;
  const horaLecturaFmt = horaLectura ? formatHoraAR(horaLectura) || null : null;
  const alertsList = (alerts.data as { alerts?: { severity: string }[] } | undefined)?.alerts ?? [];
  const activeCount = alertsList.length;
  const criticalCount = alertsList.filter((a) => a.severity === 'critical').length;

  const renderTile = (id: string) => {
    switch (id) {
      case 'molienda':
        return (
          <PremiumTile
            icon={<IconScale size={14} />}
            label="Molienda en Curso"
            value={moliendaKg ?? undefined}
            unit="kg"
            precision={0}
            accent="primary"
            size="hero"
            onClick={() => setMoliendaModalOpen(true)}
            hint={
              moliendaKg != null
                ? `${(moliendaKg / 1000).toFixed(2)} t${
                    moliendaHora ? ` · ${moliendaHora}` : ''
                  }${
                    moliendaAcum != null
                      ? ` · acum ${(moliendaAcum / 1000).toFixed(1)} t`
                      : ''
                  } · ver detalle`
                : 'Esperando primera lectura del turno'
            }
          />
        );
      case 'bolsas':
        return (
          <PremiumTile
            icon={<IconChartBar size={14} />}
            label="Bolsas azúcar"
            value={bolsasTotal ?? undefined}
            unit="bolsas"
            precision={0}
            accent="accent"
            size="hero"
            hint={
              bolsasTotal != null
                ? `Producidas hoy${
                    bolsasHoras != null ? ` · ${bolsasHoras}/24 h cargadas` : ''
                  }${bolsasUltima ? ` · últ. ${bolsasUltima.slice(0, 5)}` : ''}`
                : 'Esperando Datos'
            }
          />
        );
      case 'gas': {
        const gasHora = gasActual.data?.gas_m3 ?? null;
        const gasHoraEtiqueta = gasActual.data?.etiqueta ?? null;
        const gasAcumTurno = gasActual.data?.acumulado_turno_m3 ?? null;
        const gasAcumDia = gasActual.data?.acumulado_dia_m3 ?? null;
        // Suma parcial de la hora EN CURSO (estimado Influx) al acumulado mientras
        // el lab no haya cargado esa hora. Se va actualizando cada 30s.
        const enCursoParcial = gasHoraCurso.data?.m3_parcial ?? 0;
        const gasAcumTurnoLive = gasAcumTurno != null ? gasAcumTurno + enCursoParcial : null;
        const gasAcumDiaLive = gasAcumDia != null ? gasAcumDia + enCursoParcial : null;
        return (
          <PremiumTile
            icon={<IconFlame size={14} />}
            label="Consumo gas"
            value={gasTotal ?? undefined}
            unit="m³/h"
            precision={1}
            accent="warn"
            size="hero"
            onClick={() => setGasModalOpen(true)}
            hint={
              gasHora != null
                ? `${gasHora.toLocaleString('es-AR')} m³${gasHoraEtiqueta ? ` · ${gasHoraEtiqueta}` : ''}${
                    gasAcumTurnoLive != null ? ` · turno ${Math.round(gasAcumTurnoLive).toLocaleString('es-AR')} m³` : ''
                  }${gasAcumDiaLive != null ? ` · día ${Math.round(gasAcumDiaLive).toLocaleString('es-AR')} m³` : ''} · ver detalle`
                : gasTotal != null
                ? 'Calderas 2+3+6 · ver detalle'
                : 'Sin caudales'
            }
          />
        );
      }
      case 'color':
        return (
          <PremiumTile
            icon={<IconWaveSine size={14} />}
            label="Color azúcar"
            value={colorIcumsa ?? undefined}
            unit="UI"
            precision={0}
            accent="accent"
            size="hero"
            hint={
              humedadCinta != null
                ? `Humedad ${humedadCinta.toFixed(2)}%${horaLecturaFmt ? ` · ${horaLecturaFmt}` : ''}`
                : 'Sin lectura hoy'
            }
          />
        );
      case 'camiones':
        return (
          <PremiumTile
            icon={<IconTruck size={14} />}
            label="Camiones en canchón"
            value={totalCamiones ?? undefined}
            unit="camiones"
            precision={0}
            accent={totalCamiones != null && totalCamiones > 0 ? 'primary' : 'warn'}
            size="hero"
            onClick={() => setCanchonModalOpen(true)}
            hint={
              canchon.isLoading
                ? 'Consultando…'
                : totalCamiones != null
                ? 'Actualiza c/ 30 seg · ver detalle'
                : 'Sin señal'
            }
          />
        );
      case 'paradas': {
        const paradasHoy = paradasMC.data?.reliabilidad?.paradas_n ?? null;
        return (
          <PremiumTile
            icon={<IconPlayerPause size={14} />}
            label="Paradas del día"
            value={paradasHoy ?? undefined}
            unit="evt"
            precision={0}
            accent={paradasHoy != null && paradasHoy > 0 ? 'warn' : 'accent'}
            size="hero"
            onClick={() => setParadasModalOpen(true)}
            hint={
              paradasHoy != null
                ? `${paradasHoy} evento${paradasHoy === 1 ? '' : 's'} hoy · ver detalle`
                : 'Cargando…'
            }
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 px-3 sm:px-4 py-3">
        {HERO_KEYS.map((id) => (
          <div key={id}>{renderTile(id)}</div>
        ))}
      </div>
      {activeCount > 0 ? (
        <button
          onClick={() => setAlertasListOpen(true)}
          className="mx-3 sm:mx-4 mb-3 flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left transition-colors hover:bg-white/5"
          style={{
            borderColor: criticalCount > 0 ? 'var(--danger, #FF4757)' : 'var(--warn, #FFB800)',
            background: criticalCount > 0 ? 'rgba(255,71,87,0.06)' : 'rgba(255,184,0,0.06)',
          }}
        >
          <IconAlertTriangle size={14} className={criticalCount > 0 ? 'text-danger' : 'text-warn'} />
          <span className="text-xs font-semibold text-text-primary">Alertas activas: {activeCount}</span>
          <span className="text-xs text-text-muted ml-auto">
            {criticalCount > 0 ? `${criticalCount} críticas` : `${activeCount} pendientes`} · ver detalle
          </span>
        </button>
      ) : (
        <div className="mx-3 sm:mx-4 mb-3 flex items-center gap-2.5 rounded-lg border px-4 py-2.5" style={{ borderColor: 'var(--border, #1E3A5F)' }}>
          <IconAlertTriangle size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted">Operación normal — sin alertas activas</span>
        </div>
      )}
      <MoliendaEstadoModal
        open={moliendaModalOpen}
        onClose={() => setMoliendaModalOpen(false)}
        data={moliendaBloques.data}
        loading={moliendaBloques.isLoading}
      />
      <GasEstadoModal
        open={gasModalOpen}
        onClose={() => setGasModalOpen(false)}
        data={gasBloquesConCurso}
        loading={gasBloques.isLoading}
      />
      <AlertasModalAuto alerts={alertsList as ActiveAlert[]} />
      <CanchonModal open={canchonModalOpen} onClose={() => setCanchonModalOpen(false)} />
      <ParadasModal open={paradasModalOpen} onClose={() => setParadasModalOpen(false)} />
      <AlertasListModal open={alertasListOpen} onClose={() => setAlertasListOpen(false)} alerts={alertsList as ActiveAlert[]} />
    </>
  );
}
