// CU-12 (Parte B): listarGastos consulta GET /transparencia paginado.
import { afterEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../src/api/client';
import { listarGastos } from '../../src/api/transparencia.api';

afterEach(() => { vi.restoreAllMocks(); });

describe('listarGastos', () => {
  it('pide la página con límite 10 y adapta el contrato', async () => {
    const publicaciones = [{ id: 1, titulo: 'Jardín', conceptos: [], comprobantes_generales: [] }];
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { publicaciones, pagina: 2, total_paginas: 3 },
    });

    expect(await listarGastos(2)).toEqual({ success: true, publicaciones, pagina: 2, totalPaginas: 3 });
    expect(get).toHaveBeenCalledWith('/transparencia', { params: { pagina: 2, limite: 10 } });
  });

  it('sin publicaciones regresa un arreglo vacío, no un error', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { publicaciones: [], pagina: 1, total_paginas: 0 } });

    expect(await listarGastos()).toEqual({ success: true, publicaciones: [], pagina: 1, totalPaginas: 0 });
  });

  it('rechaza una respuesta que no cumple el contrato', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} });

    expect(await listarGastos()).toEqual({ success: false, error: 'El servidor devolvió un listado de gastos inválido.' });
  });

  it('traduce un error de red a un mensaje legible', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue({ code: 'ERR_NETWORK' });

    const resultado = await listarGastos();
    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/No se pudo conectar con el servidor/);
  });

  it('401/403: avisa que no tiene permiso', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue({ response: { status: 401, data: {} } });

    expect((await listarGastos()).error).toBe('No tienes permiso para consultar los gastos.');
  });
});
