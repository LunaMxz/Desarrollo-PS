// CU-14 (recordatorio de pago) - pruebas de la API. Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/recordatorios.repository.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import {
  buscarPendientePorResidente,
  buscarResidenteActivoDeUnidad,
  insertarRecordatorio,
  marcarVisto,
  obtenerAdeudoDeUnidad,
} from '../../src/repositories/recordatorios.repository.js';
import { admin, residente, findUsuarioPorId, bearer } from '../helpers/fixtures.js';

const recordatorio = {
  id: 5, unidad_id: 10, residente_id: residente.id, admin_id: admin.id,
  fecha_envio: '2026-11-06T10:00:00.000Z', fecha_visto: null,
};

beforeEach(() => {
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
  vi.mocked(buscarResidenteActivoDeUnidad).mockResolvedValue({
    id: residente.id, correo: residente.correo, unidad_identificador: 'Depto 101',
  });
  vi.mocked(obtenerAdeudoDeUnidad).mockResolvedValue({ cargos_pendientes: 2, adeudo: '3000.00' });
  vi.mocked(buscarPendientePorResidente).mockResolvedValue(null);
  vi.mocked(insertarRecordatorio).mockResolvedValue(recordatorio);
  vi.mocked(marcarVisto).mockResolvedValue({ ...recordatorio, fecha_visto: '2026-11-06T11:00:00.000Z' });
});

describe('CU-14 POST /recordatorios', () => {
  it('201: el admin envía un recordatorio al residente de la unidad', async () => {
    const res = await request(app).post('/recordatorios').set('Authorization', bearer(admin)).send({ unidad_id: 10 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Recordatorio enviado');
    expect(res.body.recordatorio).toMatchObject({ id: 5, residente_correo: residente.correo });
    expect(insertarRecordatorio).toHaveBeenCalledWith({ unidad_id: 10, residente_id: residente.id, admin_id: admin.id });
  });

  it('400 sin unidad_id', async () => {
    const res = await request(app).post('/recordatorios').set('Authorization', bearer(admin)).send({});
    expect(res.status).toBe(400);
  });

  it('404 si la unidad no tiene residente activo', async () => {
    vi.mocked(buscarResidenteActivoDeUnidad).mockResolvedValue(null);
    const res = await request(app).post('/recordatorios').set('Authorization', bearer(admin)).send({ unidad_id: 10 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('La unidad no tiene un residente activo');
  });

  it('409 si ya hay uno sin ver', async () => {
    vi.mocked(buscarPendientePorResidente).mockResolvedValue(recordatorio);
    const res = await request(app).post('/recordatorios').set('Authorization', bearer(admin)).send({ unidad_id: 10 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('El residente ya tiene un recordatorio que aún no ha visto');
    expect(insertarRecordatorio).not.toHaveBeenCalled();
  });

  it('403 para un residente y 401 sin token', async () => {
    const r1 = await request(app).post('/recordatorios').set('Authorization', bearer(residente)).send({ unidad_id: 10 });
    const r2 = await request(app).post('/recordatorios').send({ unidad_id: 10 });
    expect(r1.status).toBe(403);
    expect(r2.status).toBe(401);
  });

  it('500 si falla la BD', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(insertarRecordatorio).mockRejectedValue(new Error('BD caída'));
    const res = await request(app).post('/recordatorios').set('Authorization', bearer(admin)).send({ unidad_id: 10 });
    expect(res.status).toBe(500);
  });
});

describe('CU-14 GET /recordatorios/pendiente', () => {
  it('200 con el recordatorio y el adeudo del residente de la sesión', async () => {
    vi.mocked(buscarPendientePorResidente).mockResolvedValue(recordatorio);

    const res = await request(app).get('/recordatorios/pendiente').set('Authorization', bearer(residente));

    expect(res.status).toBe(200);
    expect(res.body.recordatorio).toEqual({
      id: 5, fecha_envio: recordatorio.fecha_envio, cargos_pendientes: 2, adeudo: 3000,
    });
    expect(buscarPendientePorResidente).toHaveBeenCalledWith(residente.id);
  });

  it('200 con null si no tiene', async () => {
    const res = await request(app).get('/recordatorios/pendiente').set('Authorization', bearer(residente));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ recordatorio: null });
  });

  it('403 para el admin', async () => {
    const res = await request(app).get('/recordatorios/pendiente').set('Authorization', bearer(admin));
    expect(res.status).toBe(403);
  });
});

describe('CU-14 PATCH /recordatorios/:id/visto', () => {
  it('200: el residente lo marca como visto', async () => {
    const res = await request(app).patch('/recordatorios/5/visto').set('Authorization', bearer(residente));
    expect(res.status).toBe(200);
    expect(res.body.recordatorio.fecha_visto).toBeTruthy();
    expect(marcarVisto).toHaveBeenCalledWith(5, residente.id);
  });

  it('404 si no es suyo o ya lo vio', async () => {
    vi.mocked(marcarVisto).mockResolvedValue(null);
    const res = await request(app).patch('/recordatorios/5/visto').set('Authorization', bearer(residente));
    expect(res.status).toBe(404);
  });

  it('403 para el admin', async () => {
    const res = await request(app).patch('/recordatorios/5/visto').set('Authorization', bearer(admin));
    expect(res.status).toBe(403);
  });
});
