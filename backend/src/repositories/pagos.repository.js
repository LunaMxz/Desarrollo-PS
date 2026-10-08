import { pool } from '../config/db.js';
export async function listarCargosPendientesOParciales(unidadId) {
  const result = await pool.query(
    `SELECT c.id, c.unidad_id, c.concepto, c.monto, c.periodo, c.estado, c.fecha_generacion,
           COALESCE(SUM(p.monto), 0) AS total_pagado,
           c.monto - COALESCE(SUM(p.monto), 0) AS saldo_pendiente
    FROM cargos c
    LEFT JOIN pagos p ON p.cargo_id = c.id
    WHERE c.unidad_id = $1
    AND c.estado IN ('pendiente', 'parcial')
    GROUP BY c.id
    ORDER BY c.periodo DESC`,
    [unidadId]
  );
  return result.rows;
}
export async function insertarPago({ cargoId, monto, fechaPago, registradoPor }) {
  const result = await pool.query(
    `INSERT INTO pagos (cargo_id, monto, fecha_pago, registrado_por)
    VALUES ($1, $2, COALESCE($3, NOW()), $4)
    RETURNING id, cargo_id, monto, fecha_pago, registrado_por`,
    [cargoId, monto, fechaPago ?? null, registradoPor]
  );
  return result.rows[0];
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
// Sin usar -- Obtener todos los cargos de una unidad
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
// CU-07: cargos de una unidad con sus pagos (una fila por combinación cargo/pago).
// El LEFT JOIN conserva los cargos que aún no tienen pagos.
export async function obtenerCargosConPagosPorUnidad(unidadId) {
  const result = await pool.query(
    `SELECT
       c.id AS cargo_id, c.unidad_id, c.concepto, c.monto AS cargo_monto,
       c.periodo, c.estado AS cargo_estado, c.fecha_generacion,
       p.id AS pago_id, p.monto AS pago_monto, p.fecha_pago, p.registrado_por
     FROM cargos c
     LEFT JOIN pagos p ON p.cargo_id = c.id
     WHERE c.unidad_id = $1
     ORDER BY c.periodo DESC, c.id DESC, p.fecha_pago ASC, p.id ASC`,
    [unidadId]
  );
  return result.rows;
}
