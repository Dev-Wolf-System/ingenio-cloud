-- 2026-06-07: grants para production.paradas_inferidas
-- anon: ya existía (frontend TrapichePanel fetchParadaAbierta via PostgREST)
-- service_role: faltaba → backend molienda-cloud y guardia fallaban silenciosamente

GRANT SELECT ON production.paradas_inferidas TO anon;
GRANT SELECT ON production.paradas_inferidas TO service_role;
