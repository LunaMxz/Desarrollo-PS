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

// CU-11: del más reciente al más antiguo (id DESC desempata si coinciden en fecha)
export async function listarComunicados() {
  const result = await pool.query(
    `SELECT id, titulo, contenido, autor_id, fecha_publicacion
     FROM comunicados
     ORDER BY fecha_publicacion DESC, id DESC`
  );
  return result.rows;
}
