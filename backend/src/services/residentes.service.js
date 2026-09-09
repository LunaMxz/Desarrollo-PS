// services/residentes.service.js
// Envoltura delgada sobre auth.service.js: la lógica de negocio de residentes
// (alta, listado, detalle, desactivación, cambio de rol) ya vive ahí (CU-04/CU-05).
import {
  registrar,
  listarResidentes,
  obtenerDetalleResidente,
  desactivarResidente,
  cambiarRolUsuario,
} from './auth.service.js';

export async function crearResidente({ correo, password, unidad_id }) {
  return registrar({ correo, password, unidad_id });
}

export async function listar({ soloActivos = true } = {}) {
  return listarResidentes({ soloActivos });
}

export async function obtenerDetalle(id) {
  return obtenerDetalleResidente(id);
}

export async function desactivar(id, adminId) {
  return desactivarResidente(id, adminId);
}

export async function cambiarRol(id, nuevoRol, adminId) {
  return cambiarRolUsuario(id, nuevoRol, adminId);
}
