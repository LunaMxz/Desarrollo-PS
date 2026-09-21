// ESTE ARCHIVO FUE HECHO POR MICHELLE VENEGAS 
// FRONTEND, BORRALO, SI TE TOCO ESTE CASO DE USO 
//ARCHIVO DE PRUEBA 

import { listarIncidencias, asignarResponsable } from '../services/incidencias.service.js';

export async function listarIncidenciasHandler(req, res, next) {
  try {
    const { estado } = req.query;
    const incidencias = await listarIncidencias({ estado });
    res.json({ incidencias });
  } catch (err) {
    next(err);
  }
}

export async function asignarResponsableHandler(req, res, next) {
  try {
    const { responsable } = req.body;
    if (!responsable) {
      const error = new Error('El campo responsable es obligatorio');
      error.status = 400;
      throw error;
    }
    const incidencia = await asignarResponsable(req.params.id, responsable);
    res.json({
      message: 'Responsable asignado exitosamente',
      incidencia,
    });
  } catch (err) {
    if (err.message === 'Incidencia no encontrada') {
      err.status = 404;
    }
    if (err.message === 'El responsable es obligatorio') {
      err.status = 400;
    }
    next(err);
  }
}