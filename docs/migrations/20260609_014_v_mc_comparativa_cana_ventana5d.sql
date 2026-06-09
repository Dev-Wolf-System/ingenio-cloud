-- v_mc_comparativa_cana: ampliar ventana de camiones (balanza) a 5 días industriales
-- para la fila "actual". Captura caña acumulada en canchón durante paradas largas.
-- Ponderados de lab siguen filtrando por dia_obj (calidad del día actual).
CREATE OR REPLACE VIEW production.v_mc_comparativa_cana AS
 WITH a AS (
         SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text) AS nl
        ), calc AS (
         SELECT a.nl,
            EXTRACT(year FROM a.nl)::integer AS anio,
                CASE
                    WHEN EXTRACT(hour FROM a.nl)::integer < 7 THEN a.nl::date - 1
                    ELSE a.nl::date
                END AS dia_obj
           FROM a
        ), mov0 AS (
         SELECT (date_trunc('hour'::text, movimientos.salida_at) - '07:00:00'::interval)::date AS dia_ind,
            movimientos.peso_neto,
            movimientos.neto_cana
           FROM legacy.movimientos
          WHERE movimientos.tipo_pesada = 'C'::text AND movimientos.destino IS NULL AND movimientos.salida_at IS NOT NULL AND movimientos.neto_cana IS NOT NULL AND movimientos.peso_neto IS NOT NULL
        ), z AS (
         SELECT COALESCE(( SELECT zz.fecha_inicio
                   FROM production.zafras zz,
                    calc
                  WHERE zz.anio = calc.anio), ( SELECT min(mov0.dia_ind) AS min
                   FROM mov0,
                    calc
                  WHERE EXTRACT(year FROM mov0.dia_ind) = calc.anio::numeric)) AS zini,
            COALESCE(( SELECT zz.fecha_fin
                   FROM production.zafras zz,
                    calc
                  WHERE zz.anio = calc.anio), '9999-12-31'::date) AS zfin
        ), mb AS (
         SELECT DISTINCT ON (v_molienda_bloques.bloque) v_molienda_bloques.bloque,
            v_molienda_bloques.acumulado_kg
           FROM production.v_molienda_bloques
          ORDER BY v_molienda_bloques.bloque, v_molienda_bloques.hora DESC
        ), mol AS (
         SELECT max(mb.acumulado_kg) FILTER (WHERE mb.bloque = 'dia_corriente'::text) AS a_mol,
            max(mb.acumulado_kg) FILTER (WHERE mb.bloque = 'dia_anterior'::text) AS c_mol,
            max(mb.acumulado_kg) FILTER (WHERE mb.bloque = 'zafra'::text) AS z_mol
           FROM mb
        ), mov AS (
         SELECT mov0.dia_ind,
            mov0.peso_neto,
            mov0.neto_cana
           FROM mov0
        ), lab AS (
         SELECT (date_trunc('hour'::text, v_mc_muestras_lab.salida_at) - '07:00:00'::interval)::date AS dia_ind,
            v_mc_muestras_lab.neto_cana,
            v_mc_muestras_lab.trash,
            v_mc_muestras_lab.pol_porciento,
            v_mc_muestras_lab.brix,
            v_mc_muestras_lab.pureza,
            v_mc_muestras_lab.rendimiento
           FROM production.v_mc_muestras_lab
          WHERE v_mc_muestras_lab.salida_at IS NOT NULL
        )
SELECT 'actual'::text AS periodo,
    ( SELECT round(mol.a_mol, 0) AS round
           FROM mol) AS molienda_kg,
    COALESCE(( SELECT round(sum(mov.peso_neto)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind >= (calc.dia_obj - 4) AND mov.dia_ind <= calc.dia_obj), 0::numeric) AS cana_bruta_kg,
    COALESCE(( SELECT round(sum(mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind >= (calc.dia_obj - 4) AND mov.dia_ind <= calc.dia_obj), 0::numeric) AS cana_neta_kg,
    COALESCE(( SELECT round(sum(mov.peso_neto - mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind >= (calc.dia_obj - 4) AND mov.dia_ind <= calc.dia_obj), 0::numeric) AS trash_kg,
    ( SELECT round((sum(lab.trash * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj AND lab.trash IS NOT NULL) AS trash_pond,
    ( SELECT round((sum(lab.rendimiento * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj AND lab.rendimiento IS NOT NULL) AS rto_pond,
    ( SELECT round((sum(lab.brix * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj AND lab.brix IS NOT NULL) AS brix_pond,
    ( SELECT round((sum(lab.pol_porciento * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj AND lab.pol_porciento IS NOT NULL) AS pol_pond,
    ( SELECT round((sum(lab.pureza * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj AND lab.pureza IS NOT NULL) AS pureza_pond,
    ( SELECT count(*) AS count
           FROM mov,
            calc
          WHERE mov.dia_ind >= (calc.dia_obj - 4) AND mov.dia_ind <= calc.dia_obj) AS n
UNION ALL
 SELECT 'ult_cierre'::text AS periodo,
    ( SELECT round(mol.c_mol, 0) AS round
           FROM mol) AS molienda_kg,
    COALESCE(( SELECT round(sum(mov.peso_neto)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = (calc.dia_obj - 1)), 0::numeric) AS cana_bruta_kg,
    COALESCE(( SELECT round(sum(mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = (calc.dia_obj - 1)), 0::numeric) AS cana_neta_kg,
    COALESCE(( SELECT round(sum(mov.peso_neto - mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = (calc.dia_obj - 1)), 0::numeric) AS trash_kg,
    ( SELECT round((sum(lab.trash * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1) AND lab.trash IS NOT NULL) AS trash_pond,
    ( SELECT round((sum(lab.rendimiento * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1) AND lab.rendimiento IS NOT NULL) AS rto_pond,
    ( SELECT round((sum(lab.brix * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1) AND lab.brix IS NOT NULL) AS brix_pond,
    ( SELECT round((sum(lab.pol_porciento * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1) AND lab.pol_porciento IS NOT NULL) AS pol_pond,
    ( SELECT round((sum(lab.pureza * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1) AND lab.pureza IS NOT NULL) AS pureza_pond,
    ( SELECT count(*) AS count
           FROM mov,
            calc
          WHERE mov.dia_ind = (calc.dia_obj - 1)) AS n
UNION ALL
 SELECT 'acumulado'::text AS periodo,
    ( SELECT round(mol.z_mol, 0) AS round
           FROM mol) AS molienda_kg,
    COALESCE(( SELECT round(sum(mov.peso_neto)::numeric, 0) AS round
           FROM mov,
            z
          WHERE mov.dia_ind >= z.zini AND mov.dia_ind <= z.zfin), 0::numeric) AS cana_bruta_kg,
    COALESCE(( SELECT round(sum(mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            z
          WHERE mov.dia_ind >= z.zini AND mov.dia_ind <= z.zfin), 0::numeric) AS cana_neta_kg,
    COALESCE(( SELECT round(sum(mov.peso_neto - mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            z
          WHERE mov.dia_ind >= z.zini AND mov.dia_ind <= z.zfin), 0::numeric) AS trash_kg,
    ( SELECT round((sum(lab.trash * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin AND lab.trash IS NOT NULL) AS trash_pond,
    ( SELECT round((sum(lab.rendimiento * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin AND lab.rendimiento IS NOT NULL) AS rto_pond,
    ( SELECT round((sum(lab.brix * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin AND lab.brix IS NOT NULL) AS brix_pond,
    ( SELECT round((sum(lab.pol_porciento * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin AND lab.pol_porciento IS NOT NULL) AS pol_pond,
    ( SELECT round((sum(lab.pureza * lab.neto_cana) / NULLIF(sum(lab.neto_cana), 0::double precision))::numeric, 2) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin AND lab.pureza IS NOT NULL) AS pureza_pond,
    ( SELECT count(*) AS count
           FROM mov,
            z
          WHERE mov.dia_ind >= z.zini AND mov.dia_ind <= z.zfin) AS n;
