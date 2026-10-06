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
export async function obtenerUnidadesConResidenteActivo() {
    const result = await pool.query(
        `SELECT uni.id, uni.identificador
        FROM unidades uni
        JOIN usuarios u ON u.unidad_id = uni.id
        WHERE u.rol = 'residente'
        AND u.activo = true
        ORDER BY uni.id`
    );
    return result.rows;
}