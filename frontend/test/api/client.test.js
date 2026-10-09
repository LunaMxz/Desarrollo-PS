// api/client: sesión, residentes, incidencias y cargos.
// Se mockea axios: no se hacen peticiones reales.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { http, interceptor } = vi.hoisted(() => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  interceptor: { fn: null },
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      ...http,
      interceptors: { request: { use: (fn) => { interceptor.fn = fn; } } },
    }),
  },
}));

import {
  login,
  logout,
  generarPasswordTemporal,
  crearResidente,
  listarResidentes,
  darDeBajaResidente,
  listarIncidenciasAbiertas,
  listarIncidenciasPendientes,
  listarIncidenciasResueltas,
  asignarResponsable,
  resolverIncidencia,
  generarCargos,
} from '../../src/api/client';

function errorHttp(status, data = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

beforeEach(() => {
  localStorage.clear();
});

describe('interceptor de peticiones', () => {
  it('adjunta el JWT guardado', () => {
    localStorage.setItem('token', 'abc');

    const config = interceptor.fn({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer abc');
  });

  it('no agrega encabezado si no hay sesión', () => {
    const config = interceptor.fn({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('mensajes de error', () => {
  it('timeout', async () => {
    http.get.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));

    const { error } = await listarResidentes();

    expect(error).toBe('El servidor tardó demasiado en responder. Intente más tarde.');
  });

  it('sin conexión', async () => {
    http.get.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));

    const { error } = await listarResidentes();

    expect(error).toMatch(/No se pudo conectar con el servidor/);
  });

  it('401/403 sin mensaje del backend usa el texto por defecto', async () => {
    http.get.mockRejectedValue(errorHttp(403));

    const { error } = await listarResidentes();

    expect(error).toBe('No tienes permiso para ver los residentes.');
  });

  it('404 sin mensaje del backend usa el texto por defecto', async () => {
    http.patch.mockRejectedValue(errorHttp(404));

    const { error } = await darDeBajaResidente(9);

    expect(error).toBe('El residente no existe.');
  });

  it('500 sin mensaje', async () => {
    http.get.mockRejectedValue(errorHttp(500));

    const { error } = await listarResidentes();

    expect(error).toBe('El servidor tuvo un problema. Intenta más tarde.');
  });

  it('otro estado sin mensaje', async () => {
    http.get.mockRejectedValue(errorHttp(418));

    const { error } = await listarResidentes();

    expect(error).toBe('Ocurrió un error inesperado. Intenta más tarde.');
  });

  it('el mensaje del backend tiene prioridad', async () => {
    http.get.mockRejectedValue(errorHttp(400, { error: 'Mensaje del backend' }));

    const { error } = await listarResidentes();

    expect(error).toBe('Mensaje del backend');
  });
});

describe('sesión', () => {
  it('login exitoso guarda token y usuario', async () => {
    http.post.mockResolvedValue({ data: { token: 't1', usuario: { id: 1, rol: 'admin' } } });

    const resultado = await login('a@a.com', 'x');

    expect(http.post).toHaveBeenCalledWith('/auth/login', { correo: 'a@a.com', password: 'x' });
    expect(resultado).toEqual({ success: true, user: { id: 1, rol: 'admin' } });
    expect(localStorage.getItem('token')).toBe('t1');
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ id: 1, rol: 'admin' });
  });

  it('login fallido regresa el error', async () => {
    http.post.mockRejectedValue(errorHttp(401));

    const resultado = await login('a@a.com', 'mala');

    expect(resultado).toEqual({ success: false, error: 'Correo o contraseña incorrectos.' });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('logout limpia la sesión', () => {
    localStorage.setItem('token', 't1');
    localStorage.setItem('user', '{}');

    logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('residentes', () => {
  it('generarPasswordTemporal genera 12 caracteres distintos cada vez', () => {
    const a = generarPasswordTemporal();
    const b = generarPasswordTemporal();

    expect(a).toHaveLength(12);
    expect(a).not.toBe(b);
  });

  it('crearResidente manda la contraseña temporal y la regresa', async () => {
    http.post.mockResolvedValue({ data: { residente: { id: 3 } } });

    const resultado = await crearResidente('n@a.com', 5);

    const [url, body] = http.post.mock.calls[0];
    expect(url).toBe('/residentes');
    expect(body).toEqual({ correo: 'n@a.com', password: resultado.passwordTemporal, unidad_id: 5 });
    expect(resultado).toMatchObject({ success: true, residente: { id: 3 } });
  });

  it('crearResidente fallido', async () => {
    http.post.mockRejectedValue(errorHttp(400, { error: 'El correo ya está registrado' }));

    expect(await crearResidente('n@a.com', 5)).toEqual({ success: false, error: 'El correo ya está registrado' });
  });

  it('listarResidentes manda el filtro soloActivos', async () => {
    http.get.mockResolvedValue({ data: { residentes: [{ id: 2 }] } });

    expect(await listarResidentes(false)).toEqual({ success: true, residentes: [{ id: 2 }] });
    expect(http.get).toHaveBeenCalledWith('/residentes', { params: { soloActivos: false } });
  });

  it('darDeBajaResidente regresa el residente y el aviso', async () => {
    http.patch.mockResolvedValue({ data: { residente: { id: 2 }, aviso: 'Verifique saldo' } });

    expect(await darDeBajaResidente(2)).toEqual({ success: true, residente: { id: 2 }, aviso: 'Verifique saldo' });
    expect(http.patch).toHaveBeenCalledWith('/residentes/2/baja');
  });
});

describe('incidencias', () => {
  const lista = [
    { id: 1, estado: 'abierto' },
    { id: 2, estado: 'en_proceso' },
    { id: 3, estado: 'resuelto', fecha_resolucion: '2026-10-01T00:00:00Z' },
    { id: 4, estado: 'resuelto', fecha_resolucion: '2026-10-05T00:00:00Z' },
  ];

  it('listarIncidenciasAbiertas filtra también en el cliente', async () => {
    http.get.mockResolvedValue({ data: { incidencias: lista } });

    const { incidencias } = await listarIncidenciasAbiertas();

    expect(http.get).toHaveBeenCalledWith('/incidencias', { params: { estado: 'abierto' } });
    expect(incidencias.map((i) => i.id)).toEqual([1]);
  });

  it('listarIncidenciasPendientes incluye abiertas y en proceso', async () => {
    http.get.mockResolvedValue({ data: { incidencias: lista } });

    const { incidencias } = await listarIncidenciasPendientes();

    expect(incidencias.map((i) => i.id)).toEqual([1, 2]);
  });

  it('listarIncidenciasResueltas ordena de la más reciente a la más antigua', async () => {
    http.get.mockResolvedValue({ data: { incidencias: lista } });

    const { incidencias } = await listarIncidenciasResueltas();

    expect(incidencias.map((i) => i.id)).toEqual([4, 3]);
  });

  it('tolera una respuesta sin arreglo', async () => {
    http.get.mockResolvedValue({ data: {} });

    expect(await listarIncidenciasAbiertas()).toEqual({ success: true, incidencias: [] });
    expect(await listarIncidenciasPendientes()).toEqual({ success: true, incidencias: [] });
    expect(await listarIncidenciasResueltas()).toEqual({ success: true, incidencias: [] });
  });

  it('errores al listar', async () => {
    http.get.mockRejectedValue(errorHttp(404));

    expect(await listarIncidenciasAbiertas()).toEqual({ success: false, error: 'La incidencia no existe.' });
    expect((await listarIncidenciasPendientes()).success).toBe(false);
    expect((await listarIncidenciasResueltas()).success).toBe(false);
  });

  it('asignarResponsable', async () => {
    http.patch.mockResolvedValue({ data: { incidencia: { id: 1, responsable: 'Plomero' } } });

    expect(await asignarResponsable(1, 'Plomero')).toEqual({ success: true, incidencia: { id: 1, responsable: 'Plomero' } });
    expect(http.patch).toHaveBeenCalledWith('/incidencias/1/asignar', { responsable: 'Plomero' });

    http.patch.mockRejectedValue(errorHttp(403));
    expect(await asignarResponsable(1, 'Plomero')).toEqual({ success: false, error: 'No tienes permiso para gestionar incidencias.' });
  });

  it('resolverIncidencia', async () => {
    http.patch.mockResolvedValue({ data: { incidencia: { id: 1, estado: 'resuelto' } } });

    expect(await resolverIncidencia(1)).toEqual({ success: true, incidencia: { id: 1, estado: 'resuelto' } });
    expect(http.patch).toHaveBeenCalledWith('/incidencias/1/resolver');

    http.patch.mockRejectedValue(errorHttp(500));
    expect((await resolverIncidencia(1)).success).toBe(false);
  });
});

describe('cargos', () => {
  it('generarCargos exitoso', async () => {
    http.post.mockResolvedValue({ data: { message: 'Cargos generados', periodo: '2026-10', cargos: [{ id: 1 }], omitidas: [] } });

    expect(await generarCargos(1500)).toEqual({
      success: true,
      mensaje: 'Cargos generados',
      periodo: '2026-10',
      cargos: [{ id: 1 }],
      omitidas: [],
      sinUnidades: false,
    });
    expect(http.post).toHaveBeenCalledWith('/cargos/generar', { monto: 1500 });
  });

  it('generarCargos sin unidades', async () => {
    http.post.mockResolvedValue({ data: {} });

    expect(await generarCargos(1500)).toMatchObject({ success: true, sinUnidades: true, cargos: [], omitidas: [] });
  });

  it('generarCargos duplicado (409)', async () => {
    http.post.mockRejectedValue(errorHttp(409, {}));

    expect(await generarCargos(1500)).toEqual({ success: false, duplicado: true, error: 'Los cargos de este mes ya fueron generados.' });
  });

  it('generarCargos otro error', async () => {
    http.post.mockRejectedValue(errorHttp(403));

    expect(await generarCargos(1500)).toEqual({ success: false, duplicado: false, error: 'No tienes permiso para generar cargos.' });
  });
});
