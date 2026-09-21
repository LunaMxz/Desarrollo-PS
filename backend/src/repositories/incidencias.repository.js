// ESTE ARCHIVO FUE HECHO POR MICHELLE VENEGAS 
// FRONTEND, BORRALO, SI TE TOCO ESTE CASO DE USO 
//ARCHIVO DE PRUEBA 

import { pool } from '../config/db.js';

export async function listar({ estado } = {}) {
  let query = `
    SELECT id, residente_id, titulo, descripcion, ubicacion, estado,
           responsable, fecha_creacion, fecha_resolucion
    FROM incidencias
  `;
  const params = [];
  if (estado) {
    params.push(estado);
    query += ` WHERE estado = $${params.length}`;
  }
  query += ` ORDER BY fecha_creacion DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function findById(id) {
  const result = await pool.query(
    `SELECT id, residente_id, titulo, descripcion, ubicacion, estado,
            responsable, fecha_creacion, fecha_resolucion
     FROM incidencias
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function actualizarResponsable(id, responsable) {
  const result = await pool.query(
    `UPDATE incidencias
     SET responsable = $1
     WHERE id = $2
     RETURNING id, residente_id, titulo, descripcion, ubicacion, estado,
               responsable, fecha_creacion, fecha_resolucion`,
    [responsable, id]
  );
  return result.rows[0] || null;
}