import { pool } from '../config/db.js';

const CAMPOS = 'id, unidad_id, residente_id, admin_id, fecha_envio, fecha_visto';

// CU-14 Recordatorio: residente activo de una unidad (una unidad tiene a lo más uno)
export async function buscarResidenteActivoDeUnidad(unidadId) {
  const result = await pool.query(
    `SELECT u.id, u.correo, un.identificador AS unidad_identificador
     FROM usuarios u
     JOIN unidades un ON un.id = u.unidad_id
     WHERE u.unidad_id = $1 AND u.rol = 'residente' AND u.activo = TRUE`,
    [unidadId]
  );
  return result.rows[0] ?? null;
}

// Adeudo actual de una unidad: cargos pendientes/parciales menos lo ya abonado
export async function obtenerAdeudoDeUnidad(unidadId) {
  const result = await pool.query(
    `SELECT COUNT(c.id)::int AS cargos_pendientes,
            COALESCE(SUM(c.monto - COALESCE(pagado.total_abonado, 0)), 0)::numeric AS adeudo
     FROM cargos c
     LEFT JOIN (
       SELECT cargo_id, SUM(monto) AS total_abonado
       FROM pagos
       GROUP BY cargo_id
     ) pagado ON pagado.cargo_id = c.id
     WHERE c.unidad_id = $1 AND c.estado IN ('pendiente', 'parcial')`,
    [unidadId]
  );
  return result.rows[0];
}

export async function buscarPendientePorResidente(residenteId) {
  const result = await pool.query(
    `SELECT ${CAMPOS}
     FROM recordatorios_pago
     WHERE residente_id = $1 AND fecha_visto IS NULL`,
    [residenteId]
  );
  return result.rows[0] ?? null;
}

export async function insertarRecordatorio({ unidad_id, residente_id, admin_id }) {
  const result = await pool.query(
    `INSERT INTO recordatorios_pago (unidad_id, residente_id, admin_id)
     VALUES ($1, $2, $3)
     RETURNING ${CAMPOS}`,
    [unidad_id, residente_id, admin_id]
  );
  return result.rows[0];
}

// Solo el residente dueño puede marcarlo, y solo si no lo había visto
export async function marcarVisto(id, residenteId) {
  const result = await pool.query(
    `UPDATE recordatorios_pago
     SET fecha_visto = NOW()
     WHERE id = $1 AND residente_id = $2 AND fecha_visto IS NULL
     RETURNING ${CAMPOS}`,
    [id, residenteId]
  );
  return result.rows[0] ?? null;
}
