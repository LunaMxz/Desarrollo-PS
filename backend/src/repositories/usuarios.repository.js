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
export async function verificarUnidadTieneResidenteActivo(unidadId) {
  const result = await pool.query(
    `SELECT id FROM usuarios 
     WHERE unidad_id = $1 
     AND rol = 'residente' 
     AND activo = true`,
    [unidadId]
  );
  return result.rows.length > 0;
}
export async function crearUsuario({ correo, passwordHash, rol, unidadId }) {
  const result = await pool.query(
    `INSERT INTO usuarios (correo, password_hash, rol, unidad_id, activo)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, correo, rol, unidad_id, activo, fecha_creacion`,
    [correo, passwordHash, rol, unidadId]
  );
  return result.rows[0];
}
export async function desactivarUsuario(id) {
  const result = await pool.query(
    `UPDATE usuarios 
     SET activo = false 
     WHERE id = $1 
     RETURNING id, correo, rol, unidad_id, activo, fecha_creacion`,
    [id]
  );
  return result.rows[0] || null;
}
export async function obtenerResidentes({ soloActivos = true } = {}) {
  let query = `
    SELECT u.id, u.correo, u.rol, u.unidad_id, u.activo, u.fecha_creacion,
           uni.identificador as unidad_identificador
    FROM usuarios u
    LEFT JOIN unidades uni ON u.unidad_id = uni.id
    WHERE u.rol = 'residente'
  `;
  const params = [];
  if (soloActivos) {
    query += ` AND u.activo = true`;
  }
  query += ` ORDER BY u.fecha_creacion DESC`; 
  const result = await pool.query(query, params);
  return result.rows;
}
export async function obtenerResidenteConUnidad(id) {
  const result = await pool.query(
    `SELECT u.id, u.correo, u.rol, u.unidad_id, u.activo, u.fecha_creacion,
            uni.identificador as unidad_identificador
     FROM usuarios u
     LEFT JOIN unidades uni ON u.unidad_id = uni.id
     WHERE u.id = $1 AND u.rol = 'residente'`,
    [id]
  );
  return result.rows[0] || null;
}
export async function actualizarRol(id, nuevoRol) {
  const result = await pool.query(
    `UPDATE usuarios 
     SET rol = $1 
     WHERE id = $2 
     RETURNING id, correo, rol, unidad_id, activo, fecha_creacion`,
    [nuevoRol, id]
  );
  return result.rows[0] || null;
}