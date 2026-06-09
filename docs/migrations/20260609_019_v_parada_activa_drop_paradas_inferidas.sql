-- v_parada_activa: expone la parada abierta (hasta_hora IS NULL) más reciente
-- desde legacy.lab_general (sincronizada desde MSSQL por ETL Node-RED cada 5 min).
-- Reemplaza production.paradas_inferidas como fuente del banner estado Trapiche.

CREATE OR REPLACE VIEW production.v_parada_activa AS
WITH reciente AS (
  SELECT
    lg.fecha_industrial::date AS dia_ind,
    lg.desde_hora,
    lg.motivo,
    lg.maquina
  FROM legacy.lab_general lg
  WHERE lg.proceso_codigo = 'Paradas'
    AND lg.desde_hora IS NOT NULL
    AND lg.motivo IS NOT NULL
    AND lg.hasta_hora IS NULL
    AND lg.fecha_industrial::date >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 7
  ORDER BY lg.fecha_industrial DESC, lg.desde_hora DESC
  LIMIT 1
)
SELECT
  r.dia_ind,
  r.desde_hora,
  r.motivo,
  r.maquina,
  CASE
    WHEN EXTRACT(hour FROM r.desde_hora) < 7
      THEN ((r.dia_ind + 1) + r.desde_hora) AT TIME ZONE 'America/Argentina/Buenos_Aires'
    ELSE (r.dia_ind + r.desde_hora) AT TIME ZONE 'America/Argentina/Buenos_Aires'
  END AS inicio_ts
FROM reciente r;

GRANT SELECT ON production.v_parada_activa TO anon;
GRANT SELECT ON production.v_parada_activa TO authenticated;
GRANT SELECT ON production.v_parada_activa TO service_role;

DROP TABLE IF EXISTS production.paradas_inferidas CASCADE;
