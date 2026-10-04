import { listarCargosDeUnidad, registrarPago } from '../services/pagos.service.js';
export async function listarCargosHandler(req, res, next) {
    try {
        const cargos = await listarCargosDeUnidad(req.params.id);
        res.json({ cargos });
    } catch (err) {
        if (err.message === 'Id de unidad inválido') err.status = 400;
        if (err.message === 'Unidad no encontrada') err.status = 404;
        next(err);
    }
}
export async function registrarPagoHandler(req, res, next) {
    try {
        const { cargo_id, monto } = req.body;
        if (cargo_id === undefined || monto === undefined) {
            const error = new Error('cargo_id y monto son obligatorios');
            error.status = 400;
            throw error;
        }
        const pago = await registrarPago({ cargoId: cargo_id, monto, registradoPor: req.user.id });
        res.status(201).json({ message: 'Pago registrado exitosamente', pago });
    } catch (err) {
        next(err);
        }
}