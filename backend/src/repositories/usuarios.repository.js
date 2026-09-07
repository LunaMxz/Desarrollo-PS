import { pool } from '../config/db.js';
export async function findByCorreo(correo) {
  const result = await pool.query(
    `SELECT id, correo, password_hash, rol, unidad_id, activo, fecha_creacion
     FROM usuarios
     WHERE correo = $1`,
    [correo]
  );
  return result.rows[0] || null;
}
export async function findById(id) {
  const result = await pool.query(
    `SELECT id, correo, rol, unidad_id, activo, fecha_creacion
     FROM usuarios
     WHERE id = $1`,
    [id]
  ); 
  return result.rows[0] || null;
}
export async function isActive(id) {
  const result = await pool.query(
    'SELECT activo FROM usuarios WHERE id = $1',
    [id]
  );
  return result.rows[0]?.activo === true;
}