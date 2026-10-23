// CU-10: Publicar comunicado (administrador)
// Pruebas unitarias de comunicados.service.publicarComunicado y del INSERT del repositorio.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import { publicarComunicado } from '../../src/services/comunicados.service.js';
import { insertarComunicado } from '../../src/repositories/comunicados.repository.js';

const guardado = { id: 1, titulo: 'Corte de agua', contenido: 'El jueves', autor_id: 1, fecha_publicacion: '2026-10-22T10:00:00.000Z' };

describe('CU-10 Publicar comunicado - comunicados.service.publicarComunicado', () => {
  it('guarda título y contenido sin espacios sobrantes y con el autor recibido', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [guardado] });

    await expect(publicarComunicado({ titulo: '  Corte de agua ', contenido: ' El jueves  ', autorId: 1 }))
      .resolves.toEqual(guardado);

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/INSERT INTO comunicados/);
    expect(params).toEqual(['Corte de agua', 'El jueves', 1]);
  });

  it.each([
    ['sin título', { contenido: 'x' }, 'El campo "titulo" es obligatorio'],
    ['título solo con espacios', { titulo: '   ', contenido: 'x' }, 'El campo "titulo" es obligatorio'],
    ['título que no es texto', { titulo: 123, contenido: 'x' }, 'El campo "titulo" es obligatorio'],
    ['sin contenido', { titulo: 'Aviso' }, 'El campo "contenido" es obligatorio'],
    ['contenido solo con espacios', { titulo: 'Aviso', contenido: '  ' }, 'El campo "contenido" es obligatorio'],
    ['título de más de 150 caracteres', { titulo: 'a'.repeat(151), contenido: 'x' }, 'El título no puede exceder 150 caracteres'],
  ])('rechaza %s con status 400 sin tocar la BD', async (_caso, datos, mensaje) => {
    const error = await publicarComunicado({ ...datos, autorId: 1 }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toBe(mensaje);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('acepta un título de exactamente 150 caracteres', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [guardado] });

    await expect(publicarComunicado({ titulo: 'a'.repeat(150), contenido: 'x', autorId: 1 })).resolves.toBeDefined();
  });

  it('sin argumentos responde 400 (no truena)', async () => {
    const error = await publicarComunicado().catch((e) => e);
    expect(error.status).toBe(400);
  });
});

describe('CU-10 Publicar comunicado - comunicados.repository.insertarComunicado', () => {
  it('la fecha la pone la BD y regresa el comunicado guardado', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [guardado] });

    await expect(insertarComunicado({ titulo: 'Corte de agua', contenido: 'El jueves', autorId: 1 })).resolves.toEqual(guardado);

    const [sql] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).not.toMatch(/fecha_publicacion\s*\)/); // no se inserta la fecha a mano
    expect(sql).toMatch(/RETURNING .*fecha_publicacion/);
  });
});
