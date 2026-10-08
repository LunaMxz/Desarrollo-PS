// CU-02: Registrar pago (administrador)
// Pruebas unitarias de pagos.service.listarCargosDeUnidad y registrarPago.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/repositories/pagos.repository.js');
vi.mock('../../src/repositories/unidades.repository.js');

import { listarCargosDeUnidad, registrarPago } from '../../src/services/pagos.service.js';
import {
  findCargoById,
  insertarPago,
  sumarPagosDeCargo,
  actualizarEstadoCargo,
  listarCargosPendientesOParciales,
} from '../../src/repositories/pagos.repository.js';
import { findUnidadById } from '../../src/repositories/unidades.repository.js';
import { crearCargoFake } from '../helpers/fixtures.js';

beforeEach(() => {
  vi.mocked(findUnidadById).mockResolvedValue({ id: 10, identificador: 'Depto 101' });
  vi.mocked(findCargoById).mockResolvedValue(crearCargoFake());
  vi.mocked(sumarPagosDeCargo).mockResolvedValue('0');
  vi.mocked(insertarPago).mockImplementation(async ({ cargoId, monto, registradoPor }) => ({
    id: 1, cargo_id: cargoId, monto: monto.toFixed(2), fecha_pago: '2026-10-08T10:00:00.000Z', registrado_por: registradoPor,
  }));
  vi.mocked(actualizarEstadoCargo).mockImplementation(async (id, estado) => crearCargoFake({ id, estado }));
});

describe('CU-02 Listar cargos de unidad - pagos.service.listarCargosDeUnidad', () => {
  it('regresa los cargos pendientes/parciales con total_pagado y saldo_pendiente numéricos', async () => {
    vi.mocked(listarCargosPendientesOParciales).mockResolvedValue([
      crearCargoFake({ estado: 'parcial', total_pagado: '500.00', saldo_pendiente: '1000.00' }),
    ]);

    const cargos = await listarCargosDeUnidad('10');

    expect(cargos).toEqual([expect.objectContaining({ estado: 'parcial', total_pagado: 500, saldo_pendiente: 1000 })]);
  });

  it('400 si el id de unidad no es numérico', async () => {
    await expect(listarCargosDeUnidad('abc')).rejects.toMatchObject({ status: 400 });
  });

  it('404 si la unidad no existe', async () => {
    vi.mocked(findUnidadById).mockResolvedValue(null);

    await expect(listarCargosDeUnidad(99)).rejects.toMatchObject({ status: 404, message: 'Unidad no encontrada' });
  });
});

describe('CU-02 Registrar pago - pagos.service.registrarPago', () => {
  it('pago menor al total: deja el cargo en parcial', async () => {
    const pago = await registrarPago({ cargoId: 500, monto: 500, registradoPor: 1 });

    expect(insertarPago).toHaveBeenCalledWith({ cargoId: 500, monto: 500, registradoPor: 1 });
    expect(actualizarEstadoCargo).toHaveBeenCalledWith(500, 'parcial');
    expect(pago.cargo).toMatchObject({ estado: 'parcial', total_pagado: 500, saldo_pendiente: 1000 });
  });

  it('pago que completa el total: deja el cargo en pagado', async () => {
    vi.mocked(sumarPagosDeCargo).mockResolvedValue('500.00');

    const pago = await registrarPago({ cargoId: 500, monto: '1000', registradoPor: 1 });

    expect(actualizarEstadoCargo).toHaveBeenCalledWith(500, 'pagado');
    expect(pago.cargo).toMatchObject({ estado: 'pagado', total_pagado: 1500, saldo_pendiente: 0 });
  });

  it('acepta el pago exacto con centavos (sin error de punto flotante)', async () => {
    vi.mocked(findCargoById).mockResolvedValue(crearCargoFake({ monto: '1500.30', estado: 'parcial' }));
    vi.mocked(sumarPagosDeCargo).mockResolvedValue('1000.10');

    const pago = await registrarPago({ cargoId: 500, monto: 500.2, registradoPor: 1 });

    expect(actualizarEstadoCargo).toHaveBeenCalledWith(500, 'pagado');
    expect(pago.cargo.saldo_pendiente).toBe(0);
  });

  it('400 si el monto excede el saldo pendiente', async () => {
    vi.mocked(sumarPagosDeCargo).mockResolvedValue('1000.00');

    await expect(registrarPago({ cargoId: 500, monto: 500.01, registradoPor: 1 })).rejects.toMatchObject({
      status: 400,
      message: 'El monto excede el saldo pendiente del cargo',
    });
    expect(insertarPago).not.toHaveBeenCalled();
  });

  it('409 si el cargo ya está pagado', async () => {
    vi.mocked(findCargoById).mockResolvedValue(crearCargoFake({ estado: 'pagado' }));

    await expect(registrarPago({ cargoId: 500, monto: 1, registradoPor: 1 })).rejects.toMatchObject({
      status: 409,
      message: 'El cargo ya está pagado',
    });
    expect(insertarPago).not.toHaveBeenCalled();
  });

  it('404 si el cargo no existe', async () => {
    vi.mocked(findCargoById).mockResolvedValue(null);

    await expect(registrarPago({ cargoId: 999, monto: 1, registradoPor: 1 })).rejects.toMatchObject({ status: 404 });
  });

  it.each([0, -10, 'abc', NaN])('400 si el monto no es mayor a 0 (%s)', async (monto) => {
    await expect(registrarPago({ cargoId: 500, monto, registradoPor: 1 })).rejects.toMatchObject({ status: 400 });
    expect(insertarPago).not.toHaveBeenCalled();
  });

  it('400 si el id de cargo no es numérico', async () => {
    await expect(registrarPago({ cargoId: 'abc', monto: 10, registradoPor: 1 })).rejects.toMatchObject({ status: 400 });
  });
});
