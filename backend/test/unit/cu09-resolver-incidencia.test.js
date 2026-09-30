// CU-09: Resolver incidencia (administrador)
// Pruebas unitarias de incidencias.service.resolverIncidencia.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/repositories/incidencias.repository.js');

import { resolverIncidencia } from '../../src/services/incidencias.service.js';
import { findById, resolverIncidenciaInDB } from '../../src/repositories/incidencias.repository.js';
import { residente, crearIncidenciaFake } from '../helpers/fixtures.js';

const enProceso = crearIncidenciaFake({ estado: 'en_proceso', responsable: 'Plomería' });
const resuelta = {
  ...enProceso,
  estado: 'resuelto',
  fecha_resolucion: '2026-09-25T12:00:00.000Z',
};

describe('CU-09 Resolver incidencia - incidencias.service.resolverIncidencia', () => {
  it('marca como resuelta una incidencia con responsable asignado', async () => {
    vi.mocked(findById).mockResolvedValue(enProceso);
    vi.mocked(resolverIncidenciaInDB).mockResolvedValue(resuelta);

    const resultado = await resolverIncidencia(enProceso.id);

    expect(resolverIncidenciaInDB).toHaveBeenCalledWith(enProceso.id);
    expect(resultado).toEqual({ message: 'Incidencia resuelta exitosamente', incidencia: resuelta });
    expect(resultado.incidencia.fecha_resolucion).not.toBeNull();
  });

  it('también puede resolver una incidencia "abierta" si ya tiene responsable', async () => {
    vi.mocked(findById).mockResolvedValue({ ...enProceso, estado: 'abierto' });
    vi.mocked(resolverIncidenciaInDB).mockResolvedValue(resuelta);

    await expect(resolverIncidencia(enProceso.id)).resolves.toMatchObject({
      incidencia: { estado: 'resuelto' },
    });
  });

  it('notifica al residente que reportó la incidencia', async () => {
    vi.mocked(findById).mockResolvedValue(enProceso);
    vi.mocked(resolverIncidenciaInDB).mockResolvedValue(resuelta);

    await resolverIncidencia(enProceso.id);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`Notificando al residente ID: ${residente.id}`)
    );
  });

  it('no permite resolver una incidencia sin responsable asignado', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake({ estado: 'abierto', responsable: null }));

    await expect(resolverIncidencia(100)).rejects.toMatchObject({
      message: 'No se puede resolver una incidencia sin un responsable asignado',
      status: 400,
    });
    expect(resolverIncidenciaInDB).not.toHaveBeenCalled();
  });

  it('no permite resolver dos veces la misma incidencia', async () => {
    vi.mocked(findById).mockResolvedValue(resuelta);

    await expect(resolverIncidencia(resuelta.id)).rejects.toMatchObject({
      message: 'La incidencia ya está resuelta',
      status: 400,
    });
    expect(resolverIncidenciaInDB).not.toHaveBeenCalled();
  });

  it('lanza 404 si la incidencia no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    await expect(resolverIncidencia(999)).rejects.toMatchObject({
      message: 'Incidencia no encontrada',
      status: 404,
    });
  });

  it('lanza 400 si el id no es numérico', async () => {
    await expect(resolverIncidencia('abc')).rejects.toMatchObject({
      message: 'Id de incidencia inválido',
      status: 400,
    });
    expect(findById).not.toHaveBeenCalled();
  });
});
