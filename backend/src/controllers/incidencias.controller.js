import { asignarResponsable } from '../services/incidencias.service.js';
export async function asignarResponsableHandler(req, res, next) {
    try {
        const incidencia = await asignarResponsable(req.params.id, req.body.responsable);
        res.json({
            message: 'Responsable asignado exitosamente',
            incidencia,
        });
    } catch (err) {
        next(err);
    }
}