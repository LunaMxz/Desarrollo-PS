import { pool } from '../config/db.js';

// CU-06: inserta un cargo nuevo; siempre inicia en estado 'pendiente'
export async function insertarCargo({ unidad_id, concepto, monto, periodo }) {
  const result = await pool.query(
    `INSERT INTO cargos (unidad_id, concepto, monto, periodo, estado)
     VALUES ($1, $2, $3, $4, 'pendiente')
     RETURNING id, unidad_id, concepto, monto, periodo, estado, fecha_generacion`,
    [unidad_id, concepto, monto, periodo]
  );
  return result.rows[0];
}
