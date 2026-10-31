-- ============================================
-- Migracion 003 - Incidencias: fecha de ultima actualizacion (CU-15)
-- Ejecutar UNA vez por cada miembro del equipo en su base local.
--
-- Cambio:
--   Se agrega incidencias.fecha_actualizacion para saber cuando cambio
--   por ultima vez una incidencia (asignar responsable o resolver).
--   La usa "Mis reportes" del residente para marcar las que cambiaron
--   hace poco.
--
-- Se puede ejecutar varias veces sin romper nada (IF NOT EXISTS).
-- Todo va en una transaccion: si algo falla, no queda la base a medias.
-- ============================================

BEGIN;

-- 1. Agregar la columna (primero sin NOT NULL para poder rellenarla)
ALTER TABLE incidencias
    ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP;

-- 2. Rellenar las incidencias que ya existian.
--    No se usa NOW(): si no, TODAS las incidencias viejas aparecerian
--    como "Actualizada" en la pantalla del residente.
--    Resueltas -> su fecha de resolucion; las demas -> su fecha de creacion.
UPDATE incidencias
SET fecha_actualizacion = COALESCE(fecha_resolucion, fecha_creacion)
WHERE fecha_actualizacion IS NULL;

-- 3. Ya con datos, dejarla obligatoria y con valor por defecto
--    (las incidencias nuevas nacen con fecha_actualizacion = fecha_creacion)
ALTER TABLE incidencias
    ALTER COLUMN fecha_actualizacion SET DEFAULT NOW(),
    ALTER COLUMN fecha_actualizacion SET NOT NULL;

COMMIT;

-- ============================================
-- Recordatorios para el equipo de CU-15 Backend:
--
-- * En schema.sql agregar dentro de CREATE TABLE incidencias:
--       fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW(),
--
-- * En incidencias.repository.js agregar al SET de los UPDATE de
--   actualizarResponsableYEstado y resolverIncidenciaInDB:
--       fecha_actualizacion = NOW()
--
-- * Verificar despues de correrla:
--       SELECT id, estado, fecha_creacion, fecha_actualizacion, fecha_resolucion
--       FROM incidencias ORDER BY id;
-- ============================================
