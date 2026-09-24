import { findById, actualizarResponsableYEstado, listar, resolverIncidenciaInDB } from '../repositories/incidencias.repository.js';
const ESTADOS_VALIDOS = ['abierto', 'en_proceso', 'resuelto'];

// CU-08: lista incidencias, opcionalmente filtradas por estado, Modificado 
// por mv dudas por teams 
export async function listarIncidencias({ estado } = {}) {
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    const error = new Error('Estado inválido. Debe ser "abierto", "en_proceso" o "resuelto"');
    error.status = 400;
    throw error;
  }
  return listar({ estado });
}

export async function obtenerIncidenciaOError(id) {
    if (id === undefined || id === null || Number.isNaN(Number(id))) {
        const error = new Error('Id de incidencia inválido');
        error.status = 400;
        throw error;
    }
    const incidencia = await findById(id);
    if (!incidencia) {
        const error = new Error('Incidencia no encontrada');
        error.status = 404;
        throw error;
    }
    return incidencia;
}
export async function actualizarIncidencia(id, { responsable, estado } = {}) {
    await obtenerIncidenciaOError(id);
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
        const error = new Error('Estado inválido. Debe ser "abierto", "en_proceso" o "resuelto"');
        error.status = 400;
        throw error;
    }
    let incidencia;
    try {
        incidencia = await actualizarResponsableYEstado(id, { responsable, estado });
    } catch (err) {
        if (err.code === '22P02') {
            const error = new Error('Estado o id inválido');
            error.status = 400;
            throw error;
        }
        throw err;
    }
    if (!incidencia) {
        const error = new Error('Incidencia no encontrada');
        error.status = 404;
        throw error;
    }
    return incidencia;
}
export async function asignarResponsable(id, responsable) {
    if (!responsable || typeof responsable !== 'string' || !responsable.trim()) {
        const error = new Error('El campo "responsable" es obligatorio');
        error.status = 400;
        throw error;
    }
    const incidencia = await obtenerIncidenciaOError(id);
    if (incidencia.estado === 'resuelto') {
        const error = new Error('No se puede asignar responsable a una incidencia resuelta');
        error.status = 409;
        throw error;
    }
    const responsableAnterior = incidencia.responsable || null;
    const reasignada = Boolean(responsableAnterior);
    const actualizada = await actualizarIncidencia(id, {responsable: responsable.trim(), estado: 'en_proceso',});
    return { incidencia: actualizada, reasignada, responsableAnterior };
}

// CU-09: marca una incidencia como resuelta (fecha_resolucion la pone el repositorio)
export async function resolverIncidencia(id) {
    const incidencia = await obtenerIncidenciaOError(id);
    if (incidencia.estado === 'resuelto') {
        const error = new Error('La incidencia ya está resuelta');
        error.status = 400;
        throw error;
    }
    // Bloquear resolución si no tiene responsable asignado
    if (!incidencia.responsable) {
        const error = new Error('No se puede resolver una incidencia sin un responsable asignado');
        error.status = 400;
        throw error;
    }
    const actualizada = await resolverIncidenciaInDB(id);
    // Notificación temporal al residente
    console.log(`[Notificación] Incidencia ${id} resuelta. Notificando al residente ID: ${incidencia.residente_id}`);
    return { message: 'Incidencia resuelta exitosamente', incidencia: actualizada };
}