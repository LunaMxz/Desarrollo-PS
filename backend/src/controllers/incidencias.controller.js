import {  actualizarIncidencia } from '../services/incidencias.service.js';
export async function asignarResponsableHandler(req, res, next) {
  try {
    const { responsable } = req.body;
    if (!responsable || typeof responsable !== 'string' || !responsable.trim()) {
      const error = new Error('El campo "responsable" es obligatorio');
      error.status = 400;
      throw error;
    }
    const incidencia = await actualizarIncidencia(req.params.id, {
      responsable: responsable.trim(),
    });
    res.json({
      message: 'Responsable asignado exitosamente',
      incidencia,
    });
  } catch (err) {
    if (err.message === 'Incidencia no encontrada') {
      err.status = 404;
    }
    next(err);
  }
}