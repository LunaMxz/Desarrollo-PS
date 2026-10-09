// CU-02 (registrar pago) - pruebas de la API.
// Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/unidades.repository.js');
vi.mock('../../src/repositories/pagos.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import { findUnidadById } from '../../src/repositories/unidades.repository.js';
import {
  findCargoById,
  insertarPago,
  sumarPagosDeCargo,
  actualizarEstadoCargo,
  listarCargosPendientesOParciales,
} from '../../src/repositories/pagos.repository.js';
import { admin, residente, findUsuarioPorId, bearer, crearCargoFake } from '../helpers/fixtures.js';

beforeEach(() => {
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
  vi.mocked(findUnidadById).mockResolvedValue({ id: 10, identificador: 'Depto 101' });
  vi.mocked(listarCargosPendientesOParciales).mockResolvedValue([
    crearCargoFake({ total_pagado: '0', saldo_pendiente: '1500.00' }),
  ]);
  vi.mocked(findCargoById).mockResolvedValue(crearCargoFake());
  vi.mocked(sumarPagosDeCargo).mockResolvedValue('0');
  vi.mocked(insertarPago).mockImplementation(async ({ cargoId, monto, registradoPor }) => ({
    id: 1, cargo_id: cargoId, monto: monto.toFixed(2), fecha_pago: '2026-10-08T10:00:00.000Z', registrado_por: registradoPor,
  }));
  vi.mocked(actualizarEstadoCargo).mockImplementation(async (id, estado) => crearCargoFake({ id, estado }));
});

describe('CU-02 GET /pagos/unidades/:id/cargos', () => {
  it('200: el admin ve los cargos pendientes con su saldo', async () => {
    const res = await request(app).get('/pagos/unidades/10/cargos').set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.cargos[0]).toMatchObject({ id: 500, estado: 'pendiente', total_pagado: 0, saldo_pendiente: 1500 });
  });

  it('404: unidad inexistente', async () => {
    vi.mocked(findUnidadById).mockResolvedValue(null);

    const res = await request(app).get('/pagos/unidades/99/cargos').set('Authorization', bearer(admin));

    expect(res.status).toBe(404);
  });

  it('403: un residente no puede consultar cargos de unidades', async () => {
    const res = await request(app).get('/pagos/unidades/10/cargos').set('Authorization', bearer(residente));

    expect(res.status).toBe(403);
  });
});

describe('CU-02 POST /pagos', () => {
  it('201: registra un pago parcial', async () => {
    const res = await request(app).post('/pagos').set('Authorization', bearer(admin)).send({ cargo_id: 500, monto: 500 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Pago registrado exitosamente');
    expect(res.body.pago).toMatchObject({ registrado_por: admin.id, monto: '500.00' });
    expect(res.body.pago.cargo).toMatchObject({ estado: 'parcial', saldo_pendiente: 1000 });
  });

  it('400: faltan cargo_id o monto', async () => {
    const res = await request(app).post('/pagos').set('Authorization', bearer(admin)).send({ monto: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('cargo_id y monto son obligatorios');
  });

  it('409: no deja pagar un cargo ya liquidado', async () => {
    vi.mocked(findCargoById).mockResolvedValue(crearCargoFake({ estado: 'pagado' }));

    const res = await request(app).post('/pagos').set('Authorization', bearer(admin)).send({ cargo_id: 500, monto: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('El cargo ya está pagado');
  });

  it('403: un residente no puede registrar pagos', async () => {
    const res = await request(app).post('/pagos').set('Authorization', bearer(residente)).send({ cargo_id: 500, monto: 1 });

    expect(res.status).toBe(403);
    expect(insertarPago).not.toHaveBeenCalled();
  });

  it('401: sin token', async () => {
    const res = await request(app).post('/pagos').send({ cargo_id: 500, monto: 1 });

    expect(res.status).toBe(401);
  });
});
