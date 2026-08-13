export interface SectionDef {
  key: string;
  label: string;
}

export const SECTIONS: SectionDef[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'alertas', label: 'Alertas' },
  { key: 'analisis', label: 'Análisis' },
];
