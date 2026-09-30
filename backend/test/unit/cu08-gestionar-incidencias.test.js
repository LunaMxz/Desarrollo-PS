// CU-08: Ver incidencias y asignar/reasignar responsable (administrador)
// Pruebas unitarias de incidencias.service (listarIncidencias, asignarResponsable,
// actualizarIncidencia, obtenerIncidenciaOError).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/repositories/incidencias.repository.js');

import {
  listarIncidencias,
  asignarResponsable,
  actualizarIncidencia,
  obtenerIncidenciaOError,
} from '../../src/services/incidencias.service.js';
import {
  listar,
  findById,
  actualizarResponsableYEstado,
} from '../../src/repositories/incidencias.repository.js';
import { crearIncidenciaFake } from '../helpers/fixtures.js';

describe('CU-08 Listar incidencias - incidencias.service.listarIncidencias', () => {
  it('lista todas las incidencias si no se envía estado', async () => {
    const todas = [crearIncidenciaFake(), crearIncidenciaFake({ id: 101, estado: 'resuelto' })];
    vi.mocked(listar).mockResolvedValue(todas);

    await expect(listarIncidencias()).resolves.toEqual(todas);
    expect(listar).toHaveBeenCalledWith({ estado: undefined });
  });

  it.each(['abierto', 'en_proceso', 'resuelto'])('filtra por el estado válido "%s"', async (estado) => {
    vi.mocked(listar).mockResolvedValue([]);

    await listarIncidencias({ estado });

    expect(listar).toHaveBeenCalledWith({ estado });
  });

  it('rechaza un estado inválido con status 400 sin consultar la BD', async () => {
    const error = await listarIncidencias({ estado: 'cerrado' }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toMatch(/Estado inválido/);
    expect(listar).not.toHaveBeenCalled();
  });
});

describe('CU-08 - incidencias.service.obtenerIncidenciaOError', () => {
  it('regresa la incidencia si existe', async () => {
    const incidencia = crearIncidenciaFake();
    vi.mocked(findById).mockResolvedValue(incidencia);

    await expect(obtenerIncidenciaOError(100)).resolves.toEqual(incidencia);
  });

  it.each([undefined, null, 'abc'])('rechaza el id inválido %s con status 400', async (id) => {
    await expect(obtenerIncidenciaOError(id)).rejects.toMatchObject({
      message: 'Id de incidencia inválido',
      status: 400,
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('lanza 404 si la incidencia no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    await expect(obtenerIncidenciaOError(999)).rejects.toMatchObject({
      message: 'Incidencia no encontrada',
      status: 404,
    });
  });
});

describe('CU-08 Asignar responsable - incidencias.service.asignarResponsable', () => {
  function actualizarRegresaLoRecibido(base) {
    vi.mocked(actualizarResponsableYEstado).mockImplementation(async (id, cambios) => ({
      ...base,
      id: Number(id),
      ...cambios,
    }));
  }

  it('asigna responsable a una incidencia abierta y la pasa a "en_proceso"', async () => {
    const abierta = crearIncidenciaFake();
    vi.mocked(findById).mockResolvedValue(abierta);
    actualizarRegresaLoRecibido(abierta);

    const resultado = await asignarResponsable(abierta.id, 'Plomería');

    expect(actualizarResponsableYEstado).toHaveBeenCalledWith(abierta.id, {
      responsable: 'Plomería',
      estado: 'en_proceso',
    });
    expect(resultado).toMatchObject({
      reasignada: false,
      responsableAnterior: null,
      incidencia: { responsable: 'Plomería', estado: 'en_proceso' },
    });
  });

  it('reasigna el responsable e informa quién era el anterior', async () => {
    const enProceso = crearIncidenciaFake({ estado: 'en_proceso', responsable: 'Plomería' });
    vi.mocked(findById).mockResolvedValue(enProceso);
    actualizarRegresaLoRecibido(enProceso);

    const resultado = await asignarResponsable(enProceso.id, 'Mantenimiento');

    expect(resultado.reasignada).toBe(true);
    expect(resultado.responsableAnterior).toBe('Plomería');
    expect(resultado.incidencia.responsable).toBe('Mantenimiento');
  });

  it('limpia espacios del nombre del responsable', async () => {
    const abierta = crearIncidenciaFake();
    vi.mocked(findById).mockResolvedValue(abierta);
    actualizarRegresaLoRecibido(abierta);

    await asignarResponsable(abierta.id, '   Jardinería  ');

    expect(vi.mocked(actualizarResponsableYEstado).mock.calls[0][1].responsable).toBe('Jardinería');
  });

  it.each([
    ['omitido', undefined],
    ['vacío', ''],
    ['solo espacios', '   '],
    ['no es texto', 123],
  ])('rechaza responsable %s con status 400', async (_caso, responsable) => {
    await expect(asignarResponsable(100, responsable)).rejects.toMatchObject({
      message: 'El campo "responsable" es obligatorio',
      status: 400,
    });
    expect(findById).not.toHaveBeenCalled();
    expect(actualizarResponsableYEstado).not.toHaveBeenCalled();
  });

  it('rechaza con 404 si la incidencia no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    await expect(asignarResponsable(999, 'Plomería')).rejects.toMatchObject({ status: 404 });
    expect(actualizarResponsableYEstado).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si el id no es numérico', async () => {
    await expect(asignarResponsable('abc', 'Plomería')).rejects.toMatchObject({ status: 400 });
  });

  it('no permite asignar responsable a una incidencia resuelta (409)', async () => {
    vi.mocked(findById).mockResolvedValue(
      crearIncidenciaFake({ estado: 'resuelto', responsable: 'Plomería' })
    );

    await expect(asignarResponsable(100, 'Mantenimiento')).rejects.toMatchObject({
      message: 'No se puede asignar responsable a una incidencia resuelta',
      status: 409,
    });
    expect(actualizarResponsableYEstado).not.toHaveBeenCalled();
  });
});

describe('CU-08 - incidencias.service.actualizarIncidencia', () => {
  it('rechaza un estado inválido con 400', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake());

    await expect(actualizarIncidencia(100, { estado: 'cancelado' })).rejects.toMatchObject({ status: 400 });
    expect(actualizarResponsableYEstado).not.toHaveBeenCalled();
  });

  it('traduce el error 22P02 de PostgreSQL a un 400', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake());
    vi.mocked(actualizarResponsableYEstado).mockRejectedValue(
      Object.assign(new Error('invalid input syntax'), { code: '22P02' })
    );

    await expect(actualizarIncidencia(100, { responsable: 'X' })).rejects.toMatchObject({
      message: 'Estado o id inválido',
      status: 400,
    });
  });

  it('propaga otros errores de la BD sin modificarlos', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake());
    vi.mocked(actualizarResponsableYEstado).mockRejectedValue(new Error('conexión perdida'));

    await expect(actualizarIncidencia(100, { responsable: 'X' })).rejects.toThrow('conexión perdida');
  });

  it('lanza 404 si la incidencia desaparece durante la actualización', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake());
    vi.mocked(actualizarResponsableYEstado).mockResolvedValue(null);

    await expect(actualizarIncidencia(100, { responsable: 'X' })).rejects.toMatchObject({ status: 404 });
  });
});
