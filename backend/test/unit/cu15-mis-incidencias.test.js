// CU-15: Estatus de mis incidencias (residente)
// Pruebas unitarias de incidencias.service.listarMisIncidencias y de la consulta del repositorio.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import { listarMisIncidencias } from '../../src/services/incidencias.service.js';
import { listarPorResidente } from '../../src/repositories/incidencias.repository.js';
import { crearIncidenciaFake, residente } from '../helpers/fixtures.js';

describe('CU-15 Mis incidencias - incidencias.repository.listarPorResidente', () => {
  it('filtra por el residente y ordena de la más reciente a la más antigua', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });

    await listarPorResidente(residente.id);

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/WHERE residente_id = \$1/);
    expect(sql).toMatch(/ORDER BY fecha_creacion DESC/);
    expect(params).toEqual([residente.id]);
  });

  it('regresa los campos del contrato, incluida fecha_actualizacion', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });

    await listarPorResidente(residente.id);

    const [sql] = vi.mocked(pool.query).mock.calls[0];
    for (const campo of ['id', 'titulo', 'descripcion', 'ubicacion', 'estado', 'responsable',
      'fecha_creacion', 'fecha_actualizacion', 'fecha_resolucion']) {
      expect(sql).toContain(campo);
    }
  });
});

describe('CU-15 Mis incidencias - incidencias.service.listarMisIncidencias', () => {
  it('regresa las incidencias del residente tal como las da el repositorio', async () => {
    const incidencias = [
      crearIncidenciaFake({ id: 2, estado: 'en_proceso', responsable: 'Plomero', fecha_actualizacion: '2026-10-25T10:00:00.000Z' }),
      crearIncidenciaFake({ id: 1 }),
    ];
    vi.mocked(pool.query).mockResolvedValue({ rows: incidencias });

    await expect(listarMisIncidencias(residente.id)).resolves.toEqual(incidencias);
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([residente.id]);
  });

  it('sin incidencias regresa un arreglo vacío (no es un error)', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });

    await expect(listarMisIncidencias(residente.id)).resolves.toEqual([]);
  });
});
