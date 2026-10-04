import { pool } from '../config/db.js';
export async function findUnidadById(id) {
    const result = await pool.query(
        `SELECT id, identificador, fecha_creacion
        FROM unidades
        WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
}