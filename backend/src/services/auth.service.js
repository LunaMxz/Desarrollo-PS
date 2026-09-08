import { compararPassword, hashPassword } from '../utils/password.util.js';
import { generarToken } from '../utils/jwt.util.js';
import { findByCorreo, isActive, verificarUnidadTieneResidenteActivo, crearUsuario, findById, desactivarUsuario, obtenerResidentes, 
  obtenerResidenteConUnidad, actualizarRol } from '../repositories/usuarios.repository.js';
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
export async function registrar({ correo, password, unidad_id }) {
  const usuarioExistente = await findByCorreo(correo);
  if (usuarioExistente) {
    throw new Error('El correo ya está registrado');
  }
  const tieneResidenteActivo = await verificarUnidadTieneResidenteActivo(unidad_id);
  if (tieneResidenteActivo) {
    throw new Error('La unidad ya tiene un residente activo');
  }
  const passwordHash = await hashPassword(password);
  const nuevoUsuario = await crearUsuario({
    correo,
    passwordHash,
    rol: 'residente',
    unidadId: unidad_id
  });
  return nuevoUsuario;
}
export async function cambiarPassword(usuarioId, passwordActual, passwordNueva) {
  const usuario = await findById(usuarioId);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }
  const usuarioConHash = await findByCorreo(usuario.correo);
  const passwordValida = await compararPassword(passwordActual, usuarioConHash.password_hash);
  if (!passwordValida) {
    throw new Error('Contraseña actual incorrecta');
  }
  const nuevoHash = await hashPassword(passwordNueva);
  return { message: 'Contraseña actualizada exitosamente' };
}
export async function desactivarResidente(id, adminId) {
  const usuario = await findById(id);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }
  if (usuario.rol === 'admin') {
    throw new Error('No se puede desactivar a un administrador');
  }
  if (usuario.id === adminId) {
    throw new Error('No puedes desactivarte a ti mismo');
  }
  const usuarioDesactivado = await desactivarUsuario(id);
  return usuarioDesactivado;
}
export async function listarResidentes({ soloActivos = true } = {}) {
  const residentes = await obtenerResidentes({ soloActivos });
  return residentes;
}
export async function obtenerDetalleResidente(id) {
  const residente = await obtenerResidenteConUnidad(id);
  if (!residente) {
    throw new Error('Residente no encontrado');
  }
  return residente;
}
export async function verificarUsuarioActivo(id) {
  const activo = await isActive(id);
  return activo;
}
export async function cambiarRolUsuario(id, nuevoRol, adminId) {
  const usuario = await findById(id);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }
  if (usuario.rol === 'admin' && usuario.id !== adminId) {
    throw new Error('No tienes permiso para modificar a otro administrador');
  }
  if (!['admin', 'residente'].includes(nuevoRol)) {
    throw new Error('Rol inválido. Debe ser "admin" o "residente"');
  }
  const usuarioActualizado = await actualizarRol(id, nuevoRol);
  return usuarioActualizado;
}
export async function validarCredenciales(id) {
  const usuario = await findById(id);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }
  if (!usuario.activo) {
    throw new Error('Usuario inactivo');
  } 
  return usuario;
}