// CU-07 (estado de cuenta del residente)
// - pruebas de la API. Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/unidades.repository.js');
vi.mock('../../src/repositories/pagos.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import { findUnidadById } from '../../src/repositories/unidades.repository.js';
import { obtenerCargosConPagosPorUnidad } from '../../src/repositories/pagos.repository.js';
import { admin, residente, residenteInactivo, findUsuarioPorId, bearer, crearFilaCargoPagoFake } from '../helpers/fixtures.js';

beforeEach(() => {
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
  vi.mocked(findUnidadById).mockImplementation(async (id) => ({ id: Number(id), identificador: `Depto ${id}` }));
  vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([]);
});

describe('CU-07 GET /unidades/mi-estado-cuenta', () => {
  it('200: el residente ve su estado de cuenta vacío', async () => {
    const res = await request(app).get('/unidades/mi-estado-cuenta').set('Authorization', bearer(residente));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      unidad: { id: 10, identificador: 'Depto 10' },
      cargos: [],
      pagos: [],
      resumen: { total_cargado: 0, total_pagado: 0 },
      saldo_actual: 0,
    });
  });

  it('200: muestra cargos, pagos y saldo actual', async () => {
    vi.mocked(obtenerCargosConPagosPorUnidad).mockResolvedValue([
      crearFilaCargoPagoFake({ cargo_estado: 'parcial', pago_id: 1, pago_monto: '500.00', fecha_pago: '2026-10-05T10:00:00.000Z' }),
    ]);

    const res = await request(app).get('/unidades/mi-estado-cuenta').set('Authorization', bearer(residente));

    expect(res.status).toBe(200);
    expect(res.body.cargos[0]).toMatchObject({ estado: 'parcial', total_pagado: 500, saldo_pendiente: 1000 });
    expect(res.body.pagos).toHaveLength(1);
    expect(res.body.saldo_actual).toBe(1000);
  });

  it('usa la unidad del usuario en BD, aunque el token o la URL digan otra', async () => {
    const tokenFalso = jwt.sign({ id: residente.id, rol: 'residente', unidad_id: 99 }, process.env.JWT_SECRET);

    const res = await request(app)
      .get('/unidades/mi-estado-cuenta?unidad_id=99')
      .set('Authorization', `Bearer ${tokenFalso}`);

    expect(res.status).toBe(200);
    expect(obtenerCargosConPagosPorUnidad).toHaveBeenCalledWith(10);
    expect(res.body.unidad.id).toBe(10);
  });

  it('401: sin token', async () => {
    const res = await request(app).get('/unidades/mi-estado-cuenta');

    expect(res.status).toBe(401);
    expect(obtenerCargosConPagosPorUnidad).not.toHaveBeenCalled();
  });

  it('401: residente dado de baja', async () => {
    const res = await request(app).get('/unidades/mi-estado-cuenta').set('Authorization', bearer(residenteInactivo));

    expect(res.status).toBe(401);
  });

  it('403: un administrador no tiene estado de cuenta propio', async () => {
    const res = await request(app).get('/unidades/mi-estado-cuenta').set('Authorization', bearer(admin));

    expect(res.status).toBe(403);
    expect(obtenerCargosConPagosPorUnidad).not.toHaveBeenCalled();
  });
});
