-- v_mc_comparativa_cana: reescritura completa para usar v_mc_muestras_lab.fecha_industrial
--
-- Cambios respecto a versiones anteriores:
--   - Fuente primaria: production.v_mc_muestras_lab agrupado por fecha_industrial
--     (en lugar de legacy.movimientos por dia_ind derivado de salida_at)
--   - molienda_kg = cana_bruta_kg = SUM(peso_neto) de muestras_lab
--   - trash_pond = (SUM(peso_neto) - SUM(neto_cana)) / SUM(peso_neto) * 100
--     (método agregado, idéntico al sistema de referencia MSSQL)
--   - Ponderados brix/pol/pureza/rto: media ponderada por neto_cana desde muestras_lab
--   - actual: COALESCE(muestras_lab, movimientos) para masa y trash_pond
--   - ult_cierre: 100% muestras_lab para fecha_industrial = dia_obj - 1
--   - acumulado: 100% muestras_lab para rango de la zafra
--   - trash_kg: solo en fila actual (NULL para ult_cierre y acumulado, igual que ref)
--   - Eliminados: CTEs mb, mol (v_molienda_bloques ya no se usa)
--
-- Valores verificados contra sistema referencia MSSQL (2026-06-09):
--   actual    cana_bruta=757.940  cana_neta=662.399  trash_pond=12.61
--   ult_cierre cana_bruta=1.758.060 cana_neta=1.515.535 trash_pond=13.80 rto=6.99 pol=12.41
--   acumulado  cana_bruta=71.512.680 trash_pond=14.18(*) rto=8.75 pol=14.29
--   (*) diferirá en ±0.02 hasta que datos del día corriente sincronicen desde MSSQL

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
        ), z AS (
         SELECT COALESCE(( SELECT zz.fecha_inicio
                   FROM production.zafras zz,
                    calc
                  WHERE zz.anio = calc.anio),
                 ( SELECT min(ml.fecha_industrial::date)
                   FROM production.v_mc_muestras_lab ml,
                    calc
                  WHERE EXTRACT(year FROM ml.fecha_industrial::date) = calc.anio::numeric
                    AND ml.neto_cana IS NOT NULL AND ml.neto_cana > 0)) AS zini,
            COALESCE(( SELECT zz.fecha_fin
                   FROM production.zafras zz,
                    calc
                  WHERE zz.anio = calc.anio), '9999-12-31'::date) AS zfin
        ), lab AS (
         SELECT ml.fecha_industrial::date AS dia_ind,
            ml.neto_cana,
            ml.peso_neto,
            ml.pol_porciento,
            ml.brix,
            ml.pureza,
            ml.rendimiento
           FROM production.v_mc_muestras_lab ml
          WHERE ml.fecha_industrial IS NOT NULL
            AND ml.neto_cana IS NOT NULL
            AND ml.neto_cana > 0
        ), mov AS (
         SELECT (date_trunc('hour'::text, movimientos.salida_at) - '07:00:00'::interval)::date AS dia_ind,
            movimientos.peso_neto,
            movimientos.neto_cana
           FROM legacy.movimientos
          WHERE movimientos.tipo_pesada = 'C'::text AND movimientos.destino IS NULL AND movimientos.salida_at IS NOT NULL AND movimientos.neto_cana IS NOT NULL AND movimientos.peso_neto IS NOT NULL
        )
SELECT 'actual'::text AS periodo,
    COALESCE(( SELECT round(sum(lab.peso_neto)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj),
        ( SELECT round(sum(mov.peso_neto)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = calc.dia_obj), 0::numeric) AS molienda_kg,
    COALESCE(( SELECT round(sum(lab.peso_neto)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj),
        ( SELECT round(sum(mov.peso_neto)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = calc.dia_obj), 0::numeric) AS cana_bruta_kg,
    COALESCE(( SELECT round(sum(lab.neto_cana)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj),
        ( SELECT round(sum(mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = calc.dia_obj), 0::numeric) AS cana_neta_kg,
    COALESCE(( SELECT round(sum(lab.peso_neto - lab.neto_cana)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj),
        ( SELECT round(sum(mov.peso_neto - mov.neto_cana)::numeric, 0) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = calc.dia_obj), 0::numeric) AS trash_kg,
    COALESCE(( SELECT round(((sum(lab.peso_neto) - sum(lab.neto_cana)) / NULLIF(sum(lab.peso_neto), 0) * 100)::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj),
        ( SELECT round(((sum(mov.peso_neto) - sum(mov.neto_cana)) / NULLIF(sum(mov.peso_neto), 0) * 100)::numeric, 2) AS round
           FROM mov,
            calc
          WHERE mov.dia_ind = calc.dia_obj)) AS trash_pond,
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
           FROM lab,
            calc
          WHERE lab.dia_ind = calc.dia_obj) AS n
UNION ALL
 SELECT 'ult_cierre'::text AS periodo,
    COALESCE(( SELECT round(sum(lab.peso_neto)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1)), 0::numeric) AS molienda_kg,
    COALESCE(( SELECT round(sum(lab.peso_neto)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1)), 0::numeric) AS cana_bruta_kg,
    COALESCE(( SELECT round(sum(lab.neto_cana)::numeric, 0) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1)), 0::numeric) AS cana_neta_kg,
    NULL::numeric AS trash_kg,
    ( SELECT round(((sum(lab.peso_neto) - sum(lab.neto_cana)) / NULLIF(sum(lab.peso_neto), 0) * 100)::numeric, 2) AS round
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1)) AS trash_pond,
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
           FROM lab,
            calc
          WHERE lab.dia_ind = (calc.dia_obj - 1)) AS n
UNION ALL
 SELECT 'acumulado'::text AS periodo,
    COALESCE(( SELECT round(sum(lab.peso_neto)::numeric, 0) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin), 0::numeric) AS molienda_kg,
    COALESCE(( SELECT round(sum(lab.peso_neto)::numeric, 0) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin), 0::numeric) AS cana_bruta_kg,
    COALESCE(( SELECT round(sum(lab.neto_cana)::numeric, 0) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin), 0::numeric) AS cana_neta_kg,
    NULL::numeric AS trash_kg,
    ( SELECT round(((sum(lab.peso_neto) - sum(lab.neto_cana)) / NULLIF(sum(lab.peso_neto), 0) * 100)::numeric, 2) AS round
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin) AS trash_pond,
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
           FROM lab,
            z
          WHERE lab.dia_ind >= z.zini AND lab.dia_ind <= z.zfin) AS n;
