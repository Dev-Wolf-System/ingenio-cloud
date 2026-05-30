import { agregarCana, CanaRow } from './comparativa';

describe('agregarCana', () => {
  // fila 1: neto=100, trash=10%, brix=18, pb=500
  // fila 2: neto=300, trash=20%, brix=20, pb=1000
  const rows: CanaRow[] = [
    { peso_bruto: 500, neto_cana: 100, trash: 10, pol: 12, brix: 18, pureza: 85, rendimiento: 8 },
    { peso_bruto: 1000, neto_cana: 300, trash: 20, pol: 14, brix: 20, pureza: 90, rendimiento: 9 },
  ];

  const agg = agregarCana(rows);

  it('cana_neta_kg = suma de neto_cana', () => {
    expect(agg.cana_neta_kg).toBe(400);
  });

  it('cana_bruta_kg = suma de peso_bruto', () => {
    expect(agg.cana_bruta_kg).toBe(1500);
  });

  it('trash_kg = Σ(pb_i * trash_i/100)', () => {
    // 500*0.10 + 1000*0.20 = 50 + 200 = 250
    expect(agg.trash_kg).toBe(250);
  });

  it('trash_pond ponderado por neto_cana', () => {
    // (10*100 + 20*300) / 400 = (1000+6000)/400 = 7000/400 = 17.5
    expect(agg.trash_pond).toBe(17.5);
  });

  it('brix_pond ponderado por neto_cana', () => {
    // (18*100 + 20*300) / 400 = (1800+6000)/400 = 7800/400 = 19.5
    expect(agg.brix_pond).toBe(19.5);
  });

  it('pol_pond ponderado por neto_cana', () => {
    // (12*100 + 14*300) / 400 = (1200+4200)/400 = 5400/400 = 13.5
    expect(agg.pol_pond).toBe(13.5);
  });

  it('pureza_pond ponderado por neto_cana', () => {
    // (85*100 + 90*300) / 400 = (8500+27000)/400 = 35500/400 = 88.75
    expect(agg.pureza_pond).toBe(88.75);
  });

  it('rto_pond ponderado por neto_cana', () => {
    // (8*100 + 9*300) / 400 = (800+2700)/400 = 3500/400 = 8.75
    expect(agg.rto_pond).toBe(8.75);
  });

  it('n = cantidad de filas', () => {
    expect(agg.n).toBe(2);
  });

  it('filas vacías devuelven nulls en ponderados', () => {
    const r = agregarCana([]);
    expect(r.trash_pond).toBeNull();
    expect(r.brix_pond).toBeNull();
    expect(r.n).toBe(0);
  });

  it('fila con neto_cana null no aporta peso', () => {
    const r = agregarCana([
      { peso_bruto: 500, neto_cana: null, trash: 10, pol: null, brix: null, pureza: null, rendimiento: null },
    ]);
    expect(r.trash_pond).toBeNull();
    // trash_kg: trash es null? No, trash=10 → pb*0.10 = 50
    expect(r.trash_kg).toBe(50);
  });

  it('fila con trash null aporta 0 a trash_kg', () => {
    const r = agregarCana([
      { peso_bruto: 800, neto_cana: 200, trash: null, pol: null, brix: null, pureza: null, rendimiento: null },
    ]);
    expect(r.trash_kg).toBe(0);
    expect(r.trash_pond).toBeNull(); // trash null → no aporta al ponderado
  });
});
