// CU-11: Ver listado de comunicados (residente y administrador)
// Pruebas unitarias de comunicados.service.listarComunicados y de la consulta del repositorio.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import { listarComunicados } from '../../src/services/comunicados.service.js';
import * as comunicadosRepo from '../../src/repositories/comunicados.repository.js';

const comunicados = [
  { id: 2, titulo: 'Corte de agua', contenido: 'El jueves de 9 a 13 h', autor_id: 1, fecha_publicacion: '2026-10-21T10:00:00.000Z' },
  { id: 1, titulo: 'Junta vecinal', contenido: 'Sábado a las 10 h', autor_id: 1, fecha_publicacion: '2026-10-20T10:00:00.000Z' },
];

describe('CU-11 Listar comunicados - comunicados.repository.listarComunicados', () => {
  it('ordena del más reciente al más antiguo', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: comunicados });

    await expect(comunicadosRepo.listarComunicados()).resolves.toEqual(comunicados);

    const [sql] = vi.mocked(pool.query).mock.calls.at(-1);
    expect(sql).toMatch(/FROM comunicados/);
    expect(sql).toMatch(/ORDER BY fecha_publicacion DESC/);
  });
});

describe('CU-11 Listar comunicados - comunicados.service.listarComunicados', () => {
  it('regresa los comunicados tal como los da el repositorio', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: comunicados });

    await expect(listarComunicados()).resolves.toEqual(comunicados);
  });

  it('regresa un arreglo vacío si no hay comunicados (no es un error)', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });

    await expect(listarComunicados()).resolves.toEqual([]);
  });
});
