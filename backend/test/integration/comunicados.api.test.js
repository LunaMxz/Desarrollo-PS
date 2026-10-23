// CU-10 (publicar) y CU-11 (listar comunicados) - pruebas de la API. Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/comunicados.repository.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import { listarComunicados, insertarComunicado } from '../../src/repositories/comunicados.repository.js';
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

describe('CU-10 POST /comunicados', () => {
  const datos = { titulo: 'Corte de agua', contenido: 'El jueves de 9 a 13 h' };

  it('201: el admin publica y el autor sale del token', async () => {
    vi.mocked(insertarComunicado).mockImplementation(async (d) => ({ id: 1, ...d, autor_id: d.autorId, fecha_publicacion: '2026-10-22T10:00:00.000Z' }));

    const res = await request(app).post('/comunicados').set('Authorization', bearer(admin)).send({ ...datos, autor_id: 999 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Comunicado publicado exitosamente');
    expect(res.body.comunicado).toMatchObject({ titulo: 'Corte de agua', autor_id: admin.id });
    expect(insertarComunicado).toHaveBeenCalledWith({ ...datos, autorId: admin.id });
  });

  it('400: título vacío, con mensaje claro y sin guardar', async () => {
    const res = await request(app).post('/comunicados').set('Authorization', bearer(admin)).send({ titulo: '  ', contenido: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "titulo" es obligatorio');
    expect(insertarComunicado).not.toHaveBeenCalled();
  });

  it('400: falta el contenido', async () => {
    const res = await request(app).post('/comunicados').set('Authorization', bearer(admin)).send({ titulo: 'Aviso' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "contenido" es obligatorio');
  });

  it('403: un residente no puede publicar', async () => {
    const res = await request(app).post('/comunicados').set('Authorization', bearer(residente)).send(datos);

    expect(res.status).toBe(403);
    expect(insertarComunicado).not.toHaveBeenCalled();
  });

  it('401: sin token', async () => {
    const res = await request(app).post('/comunicados').send(datos);

    expect(res.status).toBe(401);
    expect(insertarComunicado).not.toHaveBeenCalled();
  });
});
