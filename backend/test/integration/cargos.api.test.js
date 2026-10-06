// CU-06 (generar cargo mensual)
// - pruebas de la API. Solo se mockean los repositorios: no se necesita BD.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/unidades.repository.js');
vi.mock('../../src/repositories/cargos.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import { obtenerUnidadesConResidenteActivo } from '../../src/repositories/unidades.repository.js';
import { insertarCargo } from '../../src/repositories/cargos.repository.js';
import { admin, residente, findUsuarioPorId, bearer, crearCargoFake, errorCargoDuplicado } from '../helpers/fixtures.js';

const unidades = [
  { id: 10, identificador: 'Depto 101' },
  { id: 12, identificador: 'Depto 102' },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
  vi.mocked(obtenerUnidadesConResidenteActivo).mockResolvedValue(unidades);
  vi.mocked(insertarCargo).mockImplementation(async (datos) =>
    crearCargoFake({ ...datos, monto: datos.monto.toFixed(2) })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CU-06 POST /cargos/generar', () => {
  it('201: el admin genera un cargo por unidad con residente activo', async () => {
    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({ monto: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Cargos generados para el periodo 2026-10: 2');
    expect(res.body.periodo).toBe('2026-10');
    expect(res.body.cargos).toHaveLength(2);
    expect(res.body.cargos[0]).toMatchObject({ unidad_id: 10, monto: '1500.00', periodo: '2026-10', estado: 'pendiente' });
    expect(res.body.omitidas).toEqual([]);
  });

  it('201: genera solo los faltantes e informa las unidades omitidas', async () => {
    vi.mocked(insertarCargo)
      .mockRejectedValueOnce(errorCargoDuplicado())
      .mockResolvedValueOnce(crearCargoFake({ unidad_id: 12 }));

    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({ monto: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      'Cargos generados para el periodo 2026-10: 1. Unidades omitidas por ya tener su cargo: 1'
    );
    expect(res.body.omitidas).toEqual([{ unidad_id: 10, identificador: 'Depto 101' }]);
  });

  it('409: mensaje claro si se intenta generar dos veces el mismo mes', async () => {
    vi.mocked(insertarCargo).mockRejectedValue(errorCargoDuplicado());

    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({ monto: 1500 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Los cargos del periodo 2026-10 ya fueron generados para todas las unidades con residente activo'
    );
  });

  it('200: avisa si no hay unidades con residente activo', async () => {
    vi.mocked(obtenerUnidadesConResidenteActivo).mockResolvedValue([]);

    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({ monto: 1500 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('No hay unidades con residente activo; no se generó ningún cargo');
    expect(res.body.cargos).toEqual([]);
  });

  it('400: falta el monto', async () => {
    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "monto" es obligatorio');
    expect(insertarCargo).not.toHaveBeenCalled();
  });

  it('400: monto inválido', async () => {
    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({ monto: -10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El monto debe ser un número mayor a 0');
  });

  it('500: un error inesperado de la BD no se confunde con un duplicado', async () => {
    vi.mocked(insertarCargo).mockRejectedValue(new Error('connection terminated'));

    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(admin)).send({ monto: 1500 });

    expect(res.status).toBe(500);
  });

  it('403: un residente no puede generar cargos', async () => {
    const res = await request(app).post('/cargos/generar').set('Authorization', bearer(residente)).send({ monto: 1500 });

    expect(res.status).toBe(403);
    expect(obtenerUnidadesConResidenteActivo).not.toHaveBeenCalled();
    expect(insertarCargo).not.toHaveBeenCalled();
  });

  it('401: sin token', async () => {
    const res = await request(app).post('/cargos/generar').send({ monto: 1500 });

    expect(res.status).toBe(401);
    expect(insertarCargo).not.toHaveBeenCalled();
  });
});
