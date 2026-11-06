-- ============================================
-- Migracion 004 - Recordatorios de pago (CU-14)
-- Ejecutar UNA vez por cada miembro del equipo en su base local.
--
-- Cambio:
--   Desde el reporte de morosidad el administrador puede mandar un
--   recordatorio de pago al residente de una unidad. La proxima vez que
--   el residente entre al sistema ve una ventana con sus pagos pendientes;
--   al cerrarla se guarda fecha_visto y ya no vuelve a salir.
--
-- Se puede ejecutar varias veces sin romper nada (IF NOT EXISTS).
-- Todo va en una transaccion: si algo falla, no queda la base a medias.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS recordatorios_pago (
    id            SERIAL PRIMARY KEY,
    unidad_id     INTEGER NOT NULL REFERENCES unidades(id),
    residente_id  INTEGER NOT NULL REFERENCES usuarios(id),  -- residente activo al enviarlo
    admin_id      INTEGER NOT NULL REFERENCES usuarios(id),  -- quien lo envio
    fecha_envio   TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_visto   TIMESTAMP                                   -- NULL = aun no lo ve
);

-- Un residente solo puede tener UN recordatorio sin ver a la vez
CREATE UNIQUE INDEX IF NOT EXISTS recordatorio_pendiente_unico
    ON recordatorios_pago (residente_id)
    WHERE fecha_visto IS NULL;

COMMIT;

-- ============================================
-- Verificar despues de correrla:
--     SELECT id, unidad_id, residente_id, fecha_envio, fecha_visto
--     FROM recordatorios_pago ORDER BY id;
-- ============================================
