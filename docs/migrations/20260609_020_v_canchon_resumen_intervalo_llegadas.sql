-- v_canchon_resumen: agrega intervalo_prom/min/max_min
-- Calcula tiempo entre llegadas consecutivas (entrada_at) del día industrial corriente.
-- Excluye gaps < 1 min (errores) y > 120 min (paradas largas).
CREATE OR REPLACE VIEW production.v_canchon_resumen AS
WITH unicos AS (
  SELECT DISTINCT ON (upper(trim(canchon_snapshot.patente)), upper(trim(canchon_snapshot.chofer)))
    canchon_snapshot.id_movimiento,
    canchon_snapshot.patente,
    canchon_snapshot.chofer,
    canchon_snapshot.neto_cana,
    canchon_snapshot.entrada_at,
    canchon_snapshot.pesada_at,
    canchon_snapshot.snapshot_at
  FROM production.canchon_snapshot
  WHERE (canchon_snapshot.estado IS NULL OR canchon_snapshot.estado <> 'A')
    AND canchon_snapshot.numero_ingreso IS NOT NULL
  ORDER BY upper(trim(canchon_snapshot.patente)), upper(trim(canchon_snapshot.chofer)), canchon_snapshot.entrada_at DESC
), intervalos AS (
  SELECT
    round(avg(gap_min)::numeric, 1)  AS prom,
    round(min(gap_min)::numeric, 1)  AS min_val,
    round(max(gap_min)::numeric, 1)  AS max_val
  FROM (
    SELECT extract(epoch FROM entrada_at - lag(entrada_at) OVER (ORDER BY entrada_at)) / 60.0 AS gap_min
    FROM legacy.movimientos
    WHERE tipo_pesada = 'C'
      AND destino IS NULL
      AND entrada_at IS NOT NULL
      AND entrada_at >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1
  ) g
  WHERE gap_min BETWEEN 1 AND 120
)
SELECT
  count(*)                                                                                  AS total_camiones,
  count(*) FILTER (WHERE unicos.pesada_at IS NULL)                                         AS esperando_balanza,
  count(*) FILTER (WHERE unicos.pesada_at IS NOT NULL)                                     AS pesados_sin_salir,
  coalesce(sum(unicos.neto_cana), 0::double precision)                                     AS toneladas_cana_pendiente,
  coalesce(avg(extract(epoch FROM now() - unicos.entrada_at::timestamptz) / 60)::integer, 0) AS minutos_espera_promedio,
  coalesce(max(extract(epoch FROM now() - unicos.entrada_at::timestamptz) / 60)::integer, 0) AS minutos_espera_max,
  max(unicos.snapshot_at)                                                                   AS ultimo_snapshot,
  (SELECT prom    FROM intervalos)                                                           AS intervalo_prom_min,
  (SELECT min_val FROM intervalos)                                                           AS intervalo_min_min,
  (SELECT max_val FROM intervalos)                                                           AS intervalo_max_min
FROM unicos;
