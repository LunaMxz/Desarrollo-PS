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

// CU-05: baja de residente. Es un soft delete (activo = false, nunca se borra
// el registro): la revocación de sesión ya queda cubierta porque requireAuth
// revalida "activo" contra la BD en cada request, así que el JWT vigente del
// residente deja de servir aunque no haya expirado.
export async function darDeBaja(id, adminId) {
  const residente = await desactivarResidente(id, adminId);
  return {
    residente,
    // Aviso genérico: todavía no hay lógica real de saldos/cuotas (CU-06),
    // así que se muestra siempre como recordatorio para el admin.
    avisoSaldoPendiente:
      'Verifique manualmente si el residente tiene saldo pendiente antes de confirmar la baja.',
  };
}

export async function cambiarRol(id, nuevoRol, adminId) {
  return cambiarRolUsuario(id, nuevoRol, adminId);
}
