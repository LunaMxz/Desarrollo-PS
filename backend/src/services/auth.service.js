import { compararPassword } from '../utils/password.util.js';
import { generarToken } from '../utils/jwt.util.js';
import { findByCorreo, isActive } from '../repositories/usuarios.repository.js';
export async function login(correo, password) {
  const usuario = await findByCorreo(correo);
  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }
  const passwordValida = await compararPassword(password, usuario.password_hash);
  if (!passwordValida) {
    throw new Error('Credenciales inválidas');
  }
  if (!usuario.activo) {
    throw new Error('Usuario inactivo. Contacte al administrador.');
  }
  const payload = {
    id: usuario.id,
    correo: usuario.correo,
    rol: usuario.rol,
    unidad_id: usuario.unidad_id,
  };
  const token = generarToken(payload);
  const { password_hash: _, ...usuarioSinPassword } = usuario;
  return {
    token,
    usuario: usuarioSinPassword,
  };
}