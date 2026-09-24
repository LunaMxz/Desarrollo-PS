import { pool } from '../config/db.js';
export async function actualizarResponsableYEstado(id, { responsable, estado } = {}) {
    const result = await pool.query(
        `UPDATE incidencias
        SET responsable = COALESCE($2, responsable),
        estado      = COALESCE($3, estado),
        fecha_resolucion = CASE
        WHEN $3 = 'resuelto' AND fecha_resolucion IS NULL THEN NOW()
        WHEN $3 IS NOT NULL AND $3 <> 'resuelto' THEN NULL
        ELSE fecha_resolucion
        END
        WHERE id = $1
        RETURNING id, residente_id, titulo, descripcion, ubicacion,
        estado, responsable, fecha_creacion, fecha_resolucion`,
        [id, responsable ?? null, estado ?? null]
    );
    return result.rows[0] || null;
}
export async function findById(id) {
    const result = await pool.query(
        `SELECT id, residente_id, titulo, descripcion, ubicacion,
        estado, responsable, fecha_creacion, fecha_resolucion
        FROM incidencias
        WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

// CU-08: Modificacion por MV
export async function listar({ estado } = {}) {
  const params = [];
  let query = `
    SELECT id, residente_id, titulo, descripcion, ubicacion,
           estado, responsable, fecha_creacion, fecha_resolucion
    FROM incidencias`;
  if (estado) {
    params.push(estado);
    query += ` WHERE estado = $1`;
  }
  query += ` ORDER BY fecha_creacion DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}