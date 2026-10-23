// CU-12 (Parte A): publicarGasto envía el FormData a POST /transparencia.
import { afterEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../src/api/client';
import { publicarGasto } from '../../src/api/transparencia.api';

afterEach(() => { vi.restoreAllMocks(); });

describe('publicarGasto', () => {
  it('envía el FormData sin fijar Content-Type, con timeout amplio, y reporta el progreso', async () => {
    const post = vi.spyOn(apiClient, 'post').mockImplementation(async (_url, _datos, config) => {
      config.onUploadProgress({ loaded: 50, total: 200 });
      config.onUploadProgress({ loaded: 200, total: 200 });
      return { data: { message: 'Publicación creada', publicacion: { id: 1, titulo: 'Jardín', total: 2500 } } };
    });
    const formData = new FormData();
    const progreso = vi.fn();

    const resultado = await publicarGasto(formData, progreso);

    expect(resultado).toEqual({ success: true, publicacion: { id: 1, titulo: 'Jardín', total: 2500 }, mensaje: 'Publicación creada' });
    const [url, datos, config] = post.mock.calls[0];
    expect(url).toBe('/transparencia');
    expect(datos).toBe(formData);
    expect(config.timeout).toBe(60000);
    expect(config.headers?.['Content-Type']).toBeUndefined();
    expect(progreso.mock.calls).toEqual([[25], [100]]);
  });

  it('funciona sin callback de progreso', async () => {
    vi.spyOn(apiClient, 'post').mockImplementation(async (_url, _datos, config) => {
      config.onUploadProgress({ loaded: 1, total: 2 });
      return { data: {} };
    });

    await expect(publicarGasto(new FormData())).resolves.toMatchObject({ success: true, mensaje: 'Gasto publicado correctamente.' });
  });

  it.each([
    ['el mensaje del backend', { response: { status: 400, data: { error: 'El monto del concepto 1 debe ser un número mayor a 0' } } }, 'El monto del concepto 1 debe ser un número mayor a 0'],
    ['tiempo agotado', { code: 'ECONNABORTED' }, 'La subida tardó demasiado. Revisa tu conexión e intenta de nuevo; tus datos siguen aquí.'],
    ['sin conexión', { code: 'ERR_NETWORK' }, 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.'],
    ['sin permiso', { response: { status: 403, data: {} } }, 'No tienes permiso para publicar gastos.'],
    ['archivos muy pesados', { response: { status: 413, data: {} } }, 'Los archivos son demasiado pesados. Máximo 5 MB por archivo.'],
    ['error del servidor', { response: { status: 500, data: {} } }, 'El servidor tuvo un problema. Intenta más tarde.'],
  ])('traduce %s a un mensaje legible', async (_caso, error, mensaje) => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(error);

    await expect(publicarGasto(new FormData())).resolves.toEqual({ success: false, error: mensaje });
  });
});
