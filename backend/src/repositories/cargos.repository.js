import { pool } from '../config/db.js';
export async function obtenerCargosPorUnidad(unidadId) {
  const result = await pool.query(
    `SELECT id, unidad_id, concepto, monto, periodo, estado, fecha_generacion
    FROM cargos
    WHERE unidad_id = $1
    ORDER BY periodo DESC`,
    [unidadId]
  );
  return result.rows;
}
export async function findCargoById(id) {
  const result = await pool.query(
    `SELECT id, unidad_id, concepto, monto, periodo, estado, fecha_generacion
    FROM cargos
    WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
export async function sumarPagosDeCargo(cargoId) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(monto), 0)::numeric AS total
    FROM pagos
    WHERE cargo_id = $1`,
    [cargoId]
  );
  return result.rows[0].total;
}
export async function insertarPago({ cargoId, monto, registradoPor }) {
  const result = await pool.query(
    `INSERT INTO pagos (cargo_id, monto, registrado_por)
    VALUES ($1, $2, $3)
    RETURNING id, cargo_id, monto, fecha_pago, registrado_por`,
    [cargoId, monto, registradoPor]
  );
  return result.rows[0];
}
export async function actualizarEstadoCargo(id, estado) {
  const result = await pool.query(
    `UPDATE cargos
    SET estado = $1
    WHERE id = $2
    RETURNING id, unidad_id, concepto, monto, periodo, estado, fecha_generacion`,
    [estado, id]
  );
  return result.rows[0] || null;
}