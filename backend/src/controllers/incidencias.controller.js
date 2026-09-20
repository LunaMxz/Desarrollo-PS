import { asignarResponsable } from '../services/incidencias.service.js';
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
        next(err);
    }
}