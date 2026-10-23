import { afterEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../src/api/client';
import { listarComunicados } from '../../src/api/comunicados.api';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('listarComunicados', () => {
  it('consulta el endpoint y conserva el contrato', async () => {
    vi.stubEnv('VITE_COMUNICADOS_MOCK', 'false');
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { comunicados: [] } });
    expect(await listarComunicados()).toEqual({ success: true, comunicados: [] });
    expect(get).toHaveBeenCalledWith('/comunicados');
  });
  it('no oculta errores de red con datos de prueba', async () => {
    vi.stubEnv('VITE_COMUNICADOS_MOCK', 'false');
    vi.spyOn(apiClient, 'get').mockRejectedValue({ code: 'ERR_NETWORK' });
    expect(await listarComunicados()).toEqual({ success: false, error: expect.any(String) });
  });
  it('rechaza una respuesta que no cumple el contrato', async () => {
    vi.stubEnv('VITE_COMUNICADOS_MOCK', 'false');
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} });
    expect(await listarComunicados()).toEqual({ success: false, error: expect.any(String) });
  });
  it('permite usar los datos temporales explícitamente en desarrollo', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_COMUNICADOS_MOCK', 'true');
    const get = vi.spyOn(apiClient, 'get');
    const resultado = await listarComunicados();
    expect(resultado.success).toBe(true);
    expect(resultado.comunicados.length).toBeGreaterThan(10);
    expect(get).not.toHaveBeenCalled();
  });
});
