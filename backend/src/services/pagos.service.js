import {findCargoById, insertarPago, actualizarEstadoCargo, sumarPagosDeCargo, listarCargosPendientesOParciales, obtenerCargosConPagosPorUnidad }
from '../repositories/pagos.repository.js';
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
    const cargos = await listarCargosPendientesOParciales(unidadId);
    return cargos.map((cargo) => ({
        ...cargo,
        total_pagado: aMonto(aCentavos(cargo.total_pagado)),
        saldo_pendiente: aMonto(aCentavos(cargo.saldo_pendiente)),
    }));
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
        error.status = 409;
        throw error;
    }
    // Se compara en centavos: 1500.30 - 1000.10 en flotante da 500.1999... y rechazaría el pago exacto
    const montoCent = aCentavos(montoNum);
    const cargoCent = aCentavos(cargo.monto);
    const pagadoPrevioCent = aCentavos(await sumarPagosDeCargo(cargoId));
    if (montoCent > cargoCent - pagadoPrevioCent) {
        const error = new Error('El monto excede el saldo pendiente del cargo');
        error.status = 400;
        throw error;
    }
    const pago = await insertarPago({cargoId, monto: aMonto(montoCent), registradoPor});
    const nuevoTotalPagadoCent = pagadoPrevioCent + montoCent;
    const nuevoEstado = nuevoTotalPagadoCent >= cargoCent ? 'pagado' : 'parcial';
    const cargoActualizado = await actualizarEstadoCargo(cargoId, nuevoEstado);
    return {
        ...pago,
        cargo: {
            ...cargoActualizado,
            total_pagado: aMonto(nuevoTotalPagadoCent),
            saldo_pendiente: aMonto(Math.max(0, cargoCent - nuevoTotalPagadoCent)),
        },
    };
}
// Se suma en centavos para evitar errores de punto flotante (0.1 + 0.2).
function aCentavos(valor) {
    return Math.round(Number(valor) * 100);
}
function aMonto(centavos) {
    return centavos / 100;
}
// CU-07: estado de cuenta de la unidad del residente autenticado.
// unidadId viene de req.user (revalidado en BD por requireAuth), nunca del cliente.
export async function obtenerEstadoCuenta(unidadId) {
    const id = Number(unidadId);
    if (!Number.isInteger(id) || id < 1) {
        const error = new Error('El residente autenticado no tiene una unidad asignada');
        error.status = 403;
        throw error;
    }
    const unidad = await findUnidadById(id);
    if (!unidad) {
        const error = new Error('Unidad no encontrada');
        error.status = 404;
        throw error;
    }
    const filas = await obtenerCargosConPagosPorUnidad(id);
    const cargosPorId = new Map();
    const pagos = [];
    for (const fila of filas) {
        let cargo = cargosPorId.get(fila.cargo_id);
        if (!cargo) {
            cargo = {
                id: fila.cargo_id,
                unidad_id: fila.unidad_id,
                concepto: fila.concepto,
                monto: fila.cargo_monto,
                periodo: fila.periodo,
                estado: fila.cargo_estado,
                fecha_generacion: fila.fecha_generacion,
                pagos: [],
            };
            cargosPorId.set(fila.cargo_id, cargo);
        }
        if (fila.pago_id !== null && fila.pago_id !== undefined) {
            const pago = {
                id: fila.pago_id,
                cargo_id: fila.cargo_id,
                periodo: fila.periodo,
                concepto: fila.concepto,
                monto: fila.pago_monto,
                fecha_pago: fila.fecha_pago,
            };
            cargo.pagos.push(pago);
            pagos.push(pago);
        }
    }
    let totalCargadoCent = 0;
    let totalPagadoCent = 0;
    let saldoCent = 0;
    const cargos = [...cargosPorId.values()].map((cargo) => {
        const montoCent = aCentavos(cargo.monto);
        const pagadoCent = cargo.pagos.reduce((total, pago) => total + aCentavos(pago.monto), 0);
        const pendienteCent = Math.max(0, montoCent - pagadoCent);
        totalCargadoCent += montoCent;
        totalPagadoCent += pagadoCent;
        saldoCent += pendienteCent;
        return { ...cargo, total_pagado: aMonto(pagadoCent), saldo_pendiente: aMonto(pendienteCent) };
    });
    // Historial de pagos del más reciente al más antiguo
    pagos.sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago) || b.id - a.id);
    return {
        unidad: { id: unidad.id, identificador: unidad.identificador },
        cargos,
        pagos,
        resumen: {
            total_cargado: aMonto(totalCargadoCent),
            total_pagado: aMonto(totalPagadoCent),
        },
        saldo_actual: aMonto(saldoCent),
    };
}
