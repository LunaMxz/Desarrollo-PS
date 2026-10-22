// CU-11 (listar comunicados) - pruebas de la API. Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/comunicados.repository.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import { listarComunicados } from '../../src/repositories/comunicados.repository.js';
import { admin, residente, findUsuarioPorId, bearer } from '../helpers/fixtures.js';

beforeEach(() => {
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
});

describe('CU-11 GET /comunicados', () => {
  const comunicados = [
    { id: 2, titulo: 'Corte de agua', contenido: 'El jueves de 9 a 13 h', autor_id: 1, fecha_publicacion: '2026-10-21T10:00:00.000Z' },
    { id: 1, titulo: 'Junta vecinal', contenido: 'Sábado a las 10 h', autor_id: 1, fecha_publicacion: '2026-10-20T10:00:00.000Z' },
  ];

  it.each([
    ['residente', residente],
    ['admin', admin],
  ])('200: un %s ve el listado en el orden que da la BD', async (_rol, usuario) => {
    vi.mocked(listarComunicados).mockResolvedValue(comunicados);

    const res = await request(app).get('/comunicados').set('Authorization', bearer(usuario));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ comunicados });
  });

  it('200: sin comunicados responde una lista vacía, no un error', async () => {
    vi.mocked(listarComunicados).mockResolvedValue([]);

    const res = await request(app).get('/comunicados').set('Authorization', bearer(residente));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ comunicados: [] });
  });

  it('401: sin token', async () => {
    const res = await request(app).get('/comunicados');

    expect(res.status).toBe(401);
    expect(listarComunicados).not.toHaveBeenCalled();
  });

  it('500: si falla la BD responde con error', async () => {
    vi.mocked(listarComunicados).mockRejectedValue(new Error('conexión perdida'));

    const res = await request(app).get('/comunicados').set('Authorization', bearer(residente));

    expect(res.status).toBe(500);
  });
});
