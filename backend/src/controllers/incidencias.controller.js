import { listarIncidencias, asignarResponsable, resolverIncidencia } from '../services/incidencias.service.js';

// CU-08: GET /incidencias?estado=abierto 
// mv dudas por teams 
export async function listarIncidenciasHandler(req, res, next) {
  try {
    const incidencias = await listarIncidencias({ estado: req.query.estado });
    res.json({ incidencias });
  } catch (err) {
    next(err);
  }
}

export async function asignarResponsableHandler(req, res, next) {
    try {
        const { incidencia, reasignada, responsableAnterior } =
        await asignarResponsable(req.params.id, req.body.responsable);
        res.json({
            message: reasignada
            ? `Responsable reasignado (antes: ${responsableAnterior})`
            : 'Responsable asignado exitosamente',
            incidencia,
        });
    } catch (err) {
        if (err.message === 'Incidencia no encontrada') err.status = 404;
        if (err.message === 'Id de incidencia inválido') err.status = 400;
        next(err);
    }
}

// CU-09: PATCH /incidencias/:id/resolver
export async function resolverIncidenciaHandler(req, res, next) {
    try {
        const resultado = await resolverIncidencia(req.params.id);
        res.status(200).json(resultado);
    } catch (err) {
        next(err);
    }
}