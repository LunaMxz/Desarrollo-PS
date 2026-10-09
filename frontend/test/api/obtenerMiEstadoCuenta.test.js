// CU-07: api/client.obtenerMiEstadoCuenta
// Se mockea axios: no se hacen peticiones reales.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: getMock,
      post: vi.fn(),
      patch: vi.fn(),
      interceptors: { request: { use: vi.fn() } },
    }),
  },
}));

import { obtenerMiEstadoCuenta } from '../../src/api/client';

function errorHttp(status, data) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

beforeEach(() => {
  getMock.mockReset();
});

describe('obtenerMiEstadoCuenta', () => {
  it('llama a GET /unidades/mi-estado-cuenta sin mandar ninguna unidad', async () => {
    getMock.mockResolvedValue({ data: { cargos: [], pagos: [], saldo_actual: 0 } });

    await obtenerMiEstadoCuenta();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/unidades/mi-estado-cuenta');
  });

  it('regresa el estado de cuenta normalizado', async () => {
    const data = {
      unidad: { id: 5, identificador: 'A-101' },
      cargos: [{ id: 1 }],
      pagos: [{ id: 2 }],
      resumen: { total_cargado: 1500, total_pagado: 500 },
      saldo_actual: 1000,
    };
    getMock.mockResolvedValue({ data });

    const resultado = await obtenerMiEstadoCuenta();

    expect(resultado).toEqual({
      success: true,
      estadoCuenta: {
        unidad: data.unidad,
        cargos: data.cargos,
        pagos: data.pagos,
        resumen: data.resumen,
        saldoActual: 1000,
      },
    });
  });

  it('tolera una respuesta incompleta (arreglos vacíos y saldo 0)', async () => {
    getMock.mockResolvedValue({ data: {} });

    const { estadoCuenta } = await obtenerMiEstadoCuenta();

    expect(estadoCuenta).toEqual({
      unidad: null,
      cargos: [],
      pagos: [],
      resumen: { total_cargado: 0, total_pagado: 0 },
      saldoActual: 0,
    });
  });

  it('usa el mensaje del backend en un 403', async () => {
    getMock.mockRejectedValue(errorHttp(403, { error: 'El residente autenticado no tiene una unidad asignada' }));

    const resultado = await obtenerMiEstadoCuenta();

    expect(resultado).toEqual({ success: false, error: 'El residente autenticado no tiene una unidad asignada' });
  });

  it('mensaje claro si no hay conexión con el servidor', async () => {
    getMock.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));

    const resultado = await obtenerMiEstadoCuenta();

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/No se pudo conectar con el servidor/);
  });
});
