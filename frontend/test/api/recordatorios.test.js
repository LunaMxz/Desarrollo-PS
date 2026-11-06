// CU-14: api/recordatorios.api. Se mockea axios: no se hacen peticiones reales.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { http } = vi.hoisted(() => ({ http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

vi.mock('axios', () => ({
  default: { create: () => ({ ...http, interceptors: { request: { use: vi.fn() } } }) },
}));

import {
  enviarRecordatorioPago,
  marcarRecordatorioVisto,
  obtenerRecordatorioPendiente,
} from '../../src/api/recordatorios.api';

function errorHttp(status, data = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

beforeEach(() => {
  Object.values(http).forEach((fn) => fn.mockReset());
});

describe('CU-14 enviarRecordatorioPago', () => {
  it('POST /recordatorios con la unidad', async () => {
    http.post.mockResolvedValue({ data: { recordatorio: { id: 1 } } });

    await expect(enviarRecordatorioPago(5)).resolves.toEqual({ success: true, recordatorio: { id: 1 } });
    expect(http.post).toHaveBeenCalledWith('/recordatorios', { unidad_id: 5 });
  });

  it('usa el motivo que da el backend (409)', async () => {
    http.post.mockRejectedValue(errorHttp(409, { error: 'La unidad no tiene pagos pendientes' }));

    await expect(enviarRecordatorioPago(5)).resolves.toEqual({
      success: false, error: 'La unidad no tiene pagos pendientes',
    });
  });

  it('mensaje propio en un 403 sin texto', async () => {
    http.post.mockRejectedValue(errorHttp(403));

    expect((await enviarRecordatorioPago(5)).error).toBe('No tienes permiso para enviar recordatorios.');
  });
});

describe('CU-14 obtenerRecordatorioPendiente', () => {
  it('GET /recordatorios/pendiente', async () => {
    http.get.mockResolvedValue({ data: { recordatorio: { id: 7 } } });

    await expect(obtenerRecordatorioPendiente()).resolves.toEqual({ success: true, recordatorio: { id: 7 } });
    expect(http.get).toHaveBeenCalledWith('/recordatorios/pendiente');
  });

  it('null si no hay', async () => {
    http.get.mockResolvedValue({ data: { recordatorio: null } });

    await expect(obtenerRecordatorioPendiente()).resolves.toEqual({ success: true, recordatorio: null });
  });

  it('error de conexión', async () => {
    http.get.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));

    expect((await obtenerRecordatorioPendiente()).success).toBe(false);
  });
});

describe('CU-14 marcarRecordatorioVisto', () => {
  it('PATCH /recordatorios/:id/visto', async () => {
    http.patch.mockResolvedValue({ data: {} });

    await expect(marcarRecordatorioVisto(7)).resolves.toEqual({ success: true });
    expect(http.patch).toHaveBeenCalledWith('/recordatorios/7/visto');
  });

  it('error del servidor', async () => {
    http.patch.mockRejectedValue(errorHttp(500));

    expect(await marcarRecordatorioVisto(7)).toMatchObject({ success: false });
  });
});
