// CU-03: Reportar incidencia (residente)
// Pruebas unitarias de incidencias.service.crearIncidencia.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/repositories/incidencias.repository.js');

import { crearIncidencia } from '../../src/services/incidencias.service.js';
import { insertarIncidencia } from '../../src/repositories/incidencias.repository.js';
import { residente, crearIncidenciaFake } from '../helpers/fixtures.js';

const datosValidos = {
  titulo: 'Fuga de agua',
  descripcion: 'Hay una fuga en el pasillo del edificio B',
  ubicacion: 'Edificio B',
};

function insertarRegresaLoRecibido() {
  vi.mocked(insertarIncidencia).mockImplementation(async (datos) =>
    crearIncidenciaFake({ ...datos, estado: 'abierto' })
  );
}

describe('CU-03 Reportar incidencia - incidencias.service.crearIncidencia', () => {
  it('crea la incidencia asociada al residente autenticado', async () => {
    insertarRegresaLoRecibido();

    const incidencia = await crearIncidencia(residente.id, datosValidos);

    expect(insertarIncidencia).toHaveBeenCalledWith({
      residente_id: residente.id,
      titulo: datosValidos.titulo,
      descripcion: datosValidos.descripcion,
      ubicacion: datosValidos.ubicacion,
    });
    expect(incidencia).toMatchObject({ residente_id: residente.id, estado: 'abierto' });
  });

  it('limpia espacios al inicio y al final de los campos', async () => {
    insertarRegresaLoRecibido();

    await crearIncidencia(residente.id, {
      titulo: '  Fuga de agua  ',
      descripcion: '\n Descripción \t',
      ubicacion: '  Edificio B ',
    });

    expect(insertarIncidencia).toHaveBeenCalledWith({
      residente_id: residente.id,
      titulo: 'Fuga de agua',
      descripcion: 'Descripción',
      ubicacion: 'Edificio B',
    });
  });

  it.each([
    ['omitida', undefined],
    ['null', null],
    ['vacía', ''],
    ['solo espacios', '   '],
  ])('la ubicación es opcional (%s -> se guarda null)', async (_caso, ubicacion) => {
    insertarRegresaLoRecibido();

    await crearIncidencia(residente.id, { ...datosValidos, ubicacion });

    expect(vi.mocked(insertarIncidencia).mock.calls[0][0].ubicacion).toBeNull();
  });

  it('notifica al administrador cuando se crea la incidencia', async () => {
    insertarRegresaLoRecibido();

    await crearIncidencia(residente.id, datosValidos);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Notificando al administrador'));
  });

  it('rechaza si falta el título', async () => {
    const error = await crearIncidencia(residente.id, { ...datosValidos, titulo: undefined }).catch((e) => e);

    expect(error.message).toBe('Campos obligatorios incompletos: "titulo"');
    expect(error.status).toBe(400);
    expect(insertarIncidencia).not.toHaveBeenCalled();
  });

  it('rechaza si falta la descripción', async () => {
    const error = await crearIncidencia(residente.id, { ...datosValidos, descripcion: '' }).catch((e) => e);

    expect(error.message).toBe('Campos obligatorios incompletos: "descripcion"');
    expect(error.status).toBe(400);
  });

  it('indica todos los campos obligatorios que faltan', async () => {
    const error = await crearIncidencia(residente.id, {}).catch((e) => e);

    expect(error.message).toBe('Campos obligatorios incompletos: "titulo", "descripcion"');
    expect(error.status).toBe(400);
  });

  it('rechaza si no se envía body', async () => {
    await expect(crearIncidencia(residente.id)).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza título o descripción que solo tienen espacios', async () => {
    const error = await crearIncidencia(residente.id, { titulo: '   ', descripcion: '  ' }).catch((e) => e);
    expect(error.message).toBe('Campos obligatorios incompletos: "titulo", "descripcion"');
  });

  it('rechaza título que no es texto', async () => {
    await expect(crearIncidencia(residente.id, { ...datosValidos, titulo: 123 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rechaza una ubicación que no es texto', async () => {
    const error = await crearIncidencia(residente.id, { ...datosValidos, ubicacion: 42 }).catch((e) => e);

    expect(error.message).toBe('El campo "ubicacion" debe ser texto');
    expect(error.status).toBe(400);
  });

  it('acepta un título de exactamente 150 caracteres', async () => {
    insertarRegresaLoRecibido();
    await expect(
      crearIncidencia(residente.id, { ...datosValidos, titulo: 'a'.repeat(150) })
    ).resolves.toBeDefined();
  });

  it('rechaza un título de más de 150 caracteres', async () => {
    const error = await crearIncidencia(residente.id, { ...datosValidos, titulo: 'a'.repeat(151) }).catch((e) => e);

    expect(error.message).toMatch(/no pueden exceder 150 caracteres/);
    expect(error.status).toBe(400);
    expect(insertarIncidencia).not.toHaveBeenCalled();
  });

  it('rechaza una ubicación de más de 150 caracteres', async () => {
    await expect(
      crearIncidencia(residente.id, { ...datosValidos, ubicacion: 'b'.repeat(151) })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('mide la longitud después de quitar espacios', async () => {
    insertarRegresaLoRecibido();
    await expect(
      crearIncidencia(residente.id, { ...datosValidos, titulo: `  ${'a'.repeat(150)}  ` })
    ).resolves.toBeDefined();
  });
});
