import {obtenerCargosPorUnidad, findCargoById, insertarPago, actualizarEstadoCargo, sumarPagosDeCargo } from '../repositories/cargos.repository.js';
import { findUnidadById } from '../repositories/unidades.repository.js';
export async function listarCargosDeUnidad(unidadId) {
    if (unidadId === undefined || unidadId === null || Number.isNaN(Number(unidadId))) {
        const error = new Error('Id de unidad inválido');
        error.status = 400;
        throw error;
    }
    const unidad = await findUnidadById(unidadId);
    if (!unidad) {
        const error = new Error('Unidad no encontrada');
        error.status = 404;
        throw error;
    }
    return obtenerCargosPorUnidad(unidadId);
}
export async function registrarPago({ cargoId, monto, registradoPor }) {
    if (cargoId === undefined || cargoId === null || Number.isNaN(Number(cargoId))) {
        const error = new Error('Id de cargo inválido');
        error.status = 400;
        throw error;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
        const error = new Error('El monto debe ser un número mayor a 0');
        error.status = 400;
        throw error;
    }
    const cargo = await findCargoById(cargoId);
    if (!cargo) {
        const error = new Error('Cargo no encontrado');
        error.status = 404;
        throw error;
    }
    if (cargo.estado === 'pagado') {
        const error = new Error('El cargo ya está pagado');
        error.status = 400;
        throw error;
    }
    const pagadoPrevio = await sumarPagosDeCargo(cargoId);
    const saldoPendiente = Number(cargo.monto) - Number(pagadoPrevio);
    if (montoNum > saldoPendiente) {
        const error = new Error('El monto excede el saldo pendiente del cargo');
        error.status = 400;
        throw error;
    }
    const pago = await insertarPago({cargoId, monto: montoNum, registradoPor});
    const nuevoTotalPagado = Number(pagadoPrevio) + montoNum;
    const nuevoEstado = nuevoTotalPagado >= Number(cargo.monto) ? 'pagado' : 'parcial';
    const cargoActualizado = await actualizarEstadoCargo(cargoId, nuevoEstado);
    return { ...pago, cargo: cargoActualizado };
}