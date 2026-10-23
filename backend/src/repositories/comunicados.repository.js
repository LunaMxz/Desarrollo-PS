import { pool } from '../config/db.js';
export async function insertarComunicado({ titulo, contenido, autorId }) {
  const result = await pool.query(
    `INSERT INTO comunicados (titulo, contenido, autor_id)
     VALUES ($1, $2, $3)
     RETURNING id, titulo, contenido, autor_id, fecha_publicacion`,
    [titulo, contenido, autorId]
  );
  return result.rows[0];
}