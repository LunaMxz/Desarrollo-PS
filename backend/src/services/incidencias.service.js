import { findById, actualizarResponsableYEstado, } from '../repositories/incidencias.repository.js';
const ESTADOS_VALIDOS = ['abierto', 'en_proceso', 'resuelto'];
export async function obtenerIncidenciaOError(id) {
    if (!id || Number.isNaN(Number(id))) {
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
            const error = new Error('Estado inválido. Debe ser "abierto", "en_proceso" o "resuelto"');
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
    return actualizarIncidencia(id, {responsable: responsable.trim(), estado: 'en_proceso',});
}