// CU-03 (reportar), CU-08 (listar / asignar responsable) y CU-09 (resolver)
// - pruebas de la API. Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/incidencias.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import {
  findById,
  listar,
  insertarIncidencia,
  actualizarResponsableYEstado,
  resolverIncidenciaInDB,
} from '../../src/repositories/incidencias.repository.js';
import { admin, residente, findUsuarioPorId, bearer, crearIncidenciaFake } from '../helpers/fixtures.js';

beforeEach(() => {
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
});

describe('CU-03 POST /incidencias', () => {
  const datos = { titulo: 'Fuga de agua', descripcion: 'Fuga en el pasillo', ubicacion: 'Edificio B' };

  it('201: un residente reporta una incidencia a su nombre', async () => {
    vi.mocked(insertarIncidencia).mockImplementation(async (d) => crearIncidenciaFake(d));

    const res = await request(app).post('/incidencias').set('Authorization', bearer(residente)).send(datos);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Incidencia creada exitosamente');
    expect(res.body.incidencia).toMatchObject({ ...datos, estado: 'abierto', residente_id: residente.id });
  });

  it('usa el id del token y no uno enviado en el body', async () => {
    vi.mocked(insertarIncidencia).mockImplementation(async (d) => crearIncidenciaFake(d));

    await request(app)
      .post('/incidencias')
      .set('Authorization', bearer(residente))
      .send({ ...datos, residente_id: 999 })
      .expect(201);

    expect(vi.mocked(insertarIncidencia).mock.calls[0][0].residente_id).toBe(residente.id);
  });

  it('401: sin token', async () => {
    const res = await request(app).post('/incidencias').send(datos);
    expect(res.status).toBe(401);
    expect(insertarIncidencia).not.toHaveBeenCalled();
  });

  it('400: faltan campos obligatorios', async () => {
    const res = await request(app).post('/incidencias').set('Authorization', bearer(residente)).send({ ubicacion: 'B' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Campos obligatorios incompletos: "titulo", "descripcion"');
  });

  it('400: título demasiado largo', async () => {
    const res = await request(app)
      .post('/incidencias')
      .set('Authorization', bearer(residente))
      .send({ ...datos, titulo: 'x'.repeat(151) });

    expect(res.status).toBe(400);
  });
});

describe('CU-08 GET /incidencias', () => {
  it('200: el admin ve las incidencias abiertas', async () => {
    const abiertas = [crearIncidenciaFake()];
    vi.mocked(listar).mockResolvedValue(abiertas);

    const res = await request(app).get('/incidencias?estado=abierto').set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.incidencias).toEqual(abiertas);
    expect(listar).toHaveBeenCalledWith({ estado: 'abierto' });
  });

  it('400: estado inválido', async () => {
    const res = await request(app).get('/incidencias?estado=cerrado').set('Authorization', bearer(admin));
    expect(res.status).toBe(400);
  });

  it('403: un residente no puede ver el listado', async () => {
    const res = await request(app).get('/incidencias').set('Authorization', bearer(residente));
    expect(res.status).toBe(403);
    expect(listar).not.toHaveBeenCalled();
  });

  it('401: sin token', async () => {
    const res = await request(app).get('/incidencias');
    expect(res.status).toBe(401);
  });
});

describe.each(['asignar', 'responsable'])('CU-08 PATCH /incidencias/:id/%s', (ruta) => {
  beforeEach(() => {
    vi.mocked(actualizarResponsableYEstado).mockImplementation(async (id, cambios) =>
      crearIncidenciaFake({ id: Number(id), ...cambios })
    );
  });

  it('200: asigna responsable por primera vez', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake());

    const res = await request(app)
      .patch(`/incidencias/100/${ruta}`)
      .set('Authorization', bearer(admin))
      .send({ responsable: 'Plomería' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Responsable asignado exitosamente');
    expect(res.body.incidencia).toMatchObject({ responsable: 'Plomería', estado: 'en_proceso' });
  });

  it('200: reasigna e informa el responsable anterior', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake({ estado: 'en_proceso', responsable: 'Plomería' }));

    const res = await request(app)
      .patch(`/incidencias/100/${ruta}`)
      .set('Authorization', bearer(admin))
      .send({ responsable: 'Mantenimiento' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Responsable reasignado (antes: Plomería)');
  });

  it('400: falta el responsable', async () => {
    const res = await request(app).patch(`/incidencias/100/${ruta}`).set('Authorization', bearer(admin)).send({});
    expect(res.status).toBe(400);
  });

  it('400: id no numérico', async () => {
    const res = await request(app)
      .patch(`/incidencias/abc/${ruta}`)
      .set('Authorization', bearer(admin))
      .send({ responsable: 'Plomería' });
    expect(res.status).toBe(400);
  });

  it('404: la incidencia no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/incidencias/999/${ruta}`)
      .set('Authorization', bearer(admin))
      .send({ responsable: 'Plomería' });

    expect(res.status).toBe(404);
  });

  it('409: la incidencia ya está resuelta', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake({ estado: 'resuelto', responsable: 'Plomería' }));

    const res = await request(app)
      .patch(`/incidencias/100/${ruta}`)
      .set('Authorization', bearer(admin))
      .send({ responsable: 'Mantenimiento' });

    expect(res.status).toBe(409);
  });

  it('403: un residente no puede asignar responsables', async () => {
    const res = await request(app)
      .patch(`/incidencias/100/${ruta}`)
      .set('Authorization', bearer(residente))
      .send({ responsable: 'Plomería' });

    expect(res.status).toBe(403);
    expect(actualizarResponsableYEstado).not.toHaveBeenCalled();
  });
});

describe('CU-09 PATCH /incidencias/:id/resolver', () => {
  it('200: el admin resuelve una incidencia con responsable', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake({ estado: 'en_proceso', responsable: 'Plomería' }));
    vi.mocked(resolverIncidenciaInDB).mockResolvedValue(
      crearIncidenciaFake({ estado: 'resuelto', responsable: 'Plomería', fecha_resolucion: '2026-09-25T12:00:00.000Z' })
    );

    const res = await request(app).patch('/incidencias/100/resolver').set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Incidencia resuelta exitosamente');
    expect(res.body.incidencia).toMatchObject({ estado: 'resuelto', fecha_resolucion: expect.any(String) });
  });

  it('400: sin responsable asignado', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake());

    const res = await request(app).patch('/incidencias/100/resolver').set('Authorization', bearer(admin));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No se puede resolver una incidencia sin un responsable asignado');
  });

  it('400: ya estaba resuelta', async () => {
    vi.mocked(findById).mockResolvedValue(crearIncidenciaFake({ estado: 'resuelto', responsable: 'Plomería' }));

    const res = await request(app).patch('/incidencias/100/resolver').set('Authorization', bearer(admin));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La incidencia ya está resuelta');
  });

  it('404: la incidencia no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    const res = await request(app).patch('/incidencias/999/resolver').set('Authorization', bearer(admin));

    expect(res.status).toBe(404);
  });

  it('403: un residente no puede resolver incidencias', async () => {
    const res = await request(app).patch('/incidencias/100/resolver').set('Authorization', bearer(residente));

    expect(res.status).toBe(403);
    expect(resolverIncidenciaInDB).not.toHaveBeenCalled();
  });
});
