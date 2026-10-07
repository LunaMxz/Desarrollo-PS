// CU-07: Consultar estado de cuenta (residente)
// Pruebas unitarias de pagos.service.obtenerEstadoCuenta.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/repositories/pagos.repository.js');
vi.mock('../../src/repositories/unidades.repository.js');

import { obtenerEstadoCuenta } from '../../src/services/pagos.service.js';
import { obtenerCargosConPagosPorUnidad } from '../../src/repositories/pagos.repository.js';
import { findUnidadById } from '../../src/repositories/unidades.repository.js';
import { crearFilaCargoPagoFake } from '../helpers/fixtures.js';

beforeEach(() => {
  vi.mocked(findUnidadById).mockResolvedValue({ id: 10, identificador: 'Depto 101' });
});

describe('CU-07 Estado de cuenta - pagos.service.obtenerEstadoCuenta', () => {
  it('historial vacío: regresa arreglos vacíos y saldo 0', async () => {
    vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([]);

    const resultado = await obtenerEstadoCuenta(10);

    expect(obtenerCargosConPagosPorUnidad).toHaveBeenCalledWith(10);
    expect(resultado).toEqual({
      unidad: { id: 10, identificador: 'Depto 101' },
      cargos: [],
      pagos: [],
      resumen: { total_cargado: 0, total_pagado: 0 },
      saldo_actual: 0,
    });
  });

  it('agrupa los pagos dentro de su cargo y calcula el saldo de cada uno', async () => {
    vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([
      crearFilaCargoPagoFake({ cargo_estado: 'parcial', pago_id: 1, pago_monto: '500.00', fecha_pago: '2026-10-05T10:00:00.000Z' }),
      crearFilaCargoPagoFake({ cargo_estado: 'parcial', pago_id: 2, pago_monto: '300.00', fecha_pago: '2026-10-08T10:00:00.000Z' }),
    ]);

    const resultado = await obtenerEstadoCuenta(10);

    expect(resultado.cargos).toHaveLength(1);
    expect(resultado.cargos[0]).toMatchObject({ id: 500, estado: 'parcial', total_pagado: 800, saldo_pendiente: 700 });
    expect(resultado.cargos[0].pagos.map((p) => p.id)).toEqual([1, 2]);
    expect(resultado.saldo_actual).toBe(700);
  });

  it('suma el saldo de varios cargos; un cargo pagado aporta 0', async () => {
    vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([
      crearFilaCargoPagoFake({ cargo_id: 501, periodo: '2026-11' }),
      crearFilaCargoPagoFake({ cargo_estado: 'pagado', pago_id: 1, pago_monto: '1500.00', fecha_pago: '2026-10-05T10:00:00.000Z' }),
    ]);

    const resultado = await obtenerEstadoCuenta(10);

    expect(resultado.cargos.map((c) => c.saldo_pendiente)).toEqual([1500, 0]);
    expect(resultado.resumen).toEqual({ total_cargado: 3000, total_pagado: 1500 });
    expect(resultado.saldo_actual).toBe(1500);
  });

  it('suma en centavos (sin errores de punto flotante)', async () => {
    vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([
      crearFilaCargoPagoFake({ cargo_monto: '0.30', cargo_estado: 'parcial', pago_id: 1, pago_monto: '0.10', fecha_pago: '2026-10-05T10:00:00.000Z' }),
      crearFilaCargoPagoFake({ cargo_monto: '0.30', cargo_estado: 'parcial', pago_id: 2, pago_monto: '0.10', fecha_pago: '2026-10-06T10:00:00.000Z' }),
    ]);

    const resultado = await obtenerEstadoCuenta(10);

    expect(resultado.saldo_actual).toBe(0.1);
    expect(resultado.resumen.total_pagado).toBe(0.2);
  });

  it('lista los pagos del más reciente al más antiguo, sin exponer quién los registró', async () => {
    vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([
      crearFilaCargoPagoFake({ cargo_estado: 'parcial', pago_id: 1, pago_monto: '100.00', fecha_pago: '2026-10-01T10:00:00.000Z', registrado_por: 1 }),
      crearFilaCargoPagoFake({ cargo_estado: 'parcial', pago_id: 2, pago_monto: '100.00', fecha_pago: '2026-10-09T10:00:00.000Z', registrado_por: 1 }),
    ]);

    const resultado = await obtenerEstadoCuenta(10);

    expect(resultado.pagos.map((p) => p.id)).toEqual([2, 1]);
    expect(resultado.pagos[0]).not.toHaveProperty('registrado_por');
    expect(resultado.pagos[0]).toMatchObject({ cargo_id: 500, periodo: '2026-10', concepto: 'Cuota mensual' });
  });

  it.each([null, undefined, 0, 'abc'])('403 si el usuario no tiene unidad válida (%s)', async (unidadId) => {
    await expect(obtenerEstadoCuenta(unidadId)).rejects.toMatchObject({
      status: 403,
      message: 'El residente autenticado no tiene una unidad asignada',
    });
    expect(obtenerCargosConPagosPorUnidad).not.toHaveBeenCalled();
  });

  it('404 si la unidad ya no existe', async () => {
    vi.mocked(findUnidadById).mockResolvedValue(null);

    await expect(obtenerEstadoCuenta(10)).rejects.toMatchObject({ status: 404, message: 'Unidad no encontrada' });
  });
});
