// CU-15: api/client.listarMisIncidencias
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

import { listarMisIncidencias } from '../../src/api/client';

function errorHttp(status, data = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

beforeEach(() => {
  getMock.mockReset();
});

describe('CU-15 listarMisIncidencias', () => {
  it('llama a GET /incidencias/mias sin mandar ningún id de residente', async () => {
    getMock.mockResolvedValue({ data: { incidencias: [] } });

    await listarMisIncidencias();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/incidencias/mias');
  });

  it('regresa las incidencias del residente', async () => {
    const incidencias = [{ id: 2, titulo: 'Fuga' }, { id: 1, titulo: 'Ruido' }];
    getMock.mockResolvedValue({ data: { incidencias } });

    await expect(listarMisIncidencias()).resolves.toEqual({ success: true, incidencias });
  });

  it('tolera una respuesta sin arreglo de incidencias', async () => {
    getMock.mockResolvedValue({ data: {} });

    await expect(listarMisIncidencias()).resolves.toEqual({ success: true, incidencias: [] });
  });

  it('usa el mensaje del backend en un 403', async () => {
    getMock.mockRejectedValue(errorHttp(403, { error: 'Acceso denegado' }));

    await expect(listarMisIncidencias()).resolves.toEqual({ success: false, error: 'Acceso denegado' });
  });

  it('mensaje propio en un 401/403 sin texto del backend', async () => {
    getMock.mockRejectedValue(errorHttp(401));

    await expect(listarMisIncidencias()).resolves.toEqual({
      success: false,
      error: 'No tienes permiso para consultar tus reportes.',
    });
  });

  it('mensaje claro si no hay conexión o el servidor falla', async () => {
    getMock.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    expect((await listarMisIncidencias()).error).toMatch(/No se pudo conectar con el servidor/);

    getMock.mockRejectedValueOnce(errorHttp(500));
    expect((await listarMisIncidencias()).error).toMatch(/El servidor tuvo un problema/);
  });
});
