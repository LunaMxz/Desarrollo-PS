// CU-14 (recordatorio de pago): reglas de recordatorios.service y consultas del repositorio.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import {
  enviarRecordatorio,
  marcarRecordatorioVisto,
  obtenerRecordatorioPendiente,
} from '../../src/services/recordatorios.service.js';
import * as repo from '../../src/repositories/recordatorios.repository.js';

const query = () => vi.mocked(pool.query);
const residenteUnidad = { id: 2, correo: 'residente@condominio.com', unidad_identificador: 'Depto 101' };
const recordatorioFake = (extra = {}) => ({
  id: 5, unidad_id: 10, residente_id: 2, admin_id: 1,
  fecha_envio: '2026-11-06T10:00:00.000Z', fecha_visto: null, ...extra,
});

// Respuestas de pool.query en el orden en que el servicio consulta
function respuestas(...filas) {
  filas.forEach((rows) => query().mockResolvedValueOnce({ rows }));
}

describe('CU-14 recordatorios.service.enviarRecordatorio', () => {
  it('crea el recordatorio para el residente activo de una unidad con adeudo', async () => {
    respuestas([residenteUnidad], [{ cargos_pendientes: 2, adeudo: '3000.00' }], [], [recordatorioFake()]);

    const recordatorio = await enviarRecordatorio(1, '10');

    expect(recordatorio).toEqual({
      ...recordatorioFake(),
      residente_correo: 'residente@condominio.com',
      unidad_identificador: 'Depto 101',
    });
    expect(query().mock.calls[0][1]).toEqual([10]);
    expect(query().mock.calls[3][1]).toEqual([10, 2, 1]);
  });

  it.each([undefined, 'abc', 0, -3, 1.5])('400 si unidad_id es %s', async (valor) => {
    await expect(enviarRecordatorio(1, valor)).rejects.toMatchObject({ status: 400 });
    expect(query()).not.toHaveBeenCalled();
  });

  it('404 si la unidad no tiene residente activo', async () => {
    respuestas([]);
    await expect(enviarRecordatorio(1, 10)).rejects.toMatchObject({
      status: 404, message: 'La unidad no tiene un residente activo',
    });
  });

  it('409 si la unidad ya no debe nada', async () => {
    respuestas([residenteUnidad], [{ cargos_pendientes: 0, adeudo: '0' }]);
    await expect(enviarRecordatorio(1, 10)).rejects.toMatchObject({
      status: 409, message: 'La unidad no tiene pagos pendientes',
    });
  });

  it('409 si el residente ya tiene un recordatorio sin ver (no se duplica)', async () => {
    respuestas([residenteUnidad], [{ cargos_pendientes: 1, adeudo: '1500' }], [recordatorioFake()]);
    await expect(enviarRecordatorio(1, 10)).rejects.toMatchObject({ status: 409 });
    expect(query()).toHaveBeenCalledTimes(3);
  });

  it('409 si dos envíos chocan en el índice único', async () => {
    respuestas([residenteUnidad], [{ cargos_pendientes: 1, adeudo: '1500' }], []);
    query().mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    await expect(enviarRecordatorio(1, 10)).rejects.toMatchObject({ status: 409 });
  });

  it('otros errores de la BD se propagan', async () => {
    respuestas([residenteUnidad], [{ cargos_pendientes: 1, adeudo: '1500' }], []);
    query().mockRejectedValueOnce(new Error('BD caída'));
    await expect(enviarRecordatorio(1, 10)).rejects.toThrow('BD caída');
  });
});

describe('CU-14 recordatorios.service.obtenerRecordatorioPendiente', () => {
  it('regresa el recordatorio con el adeudo actual de la unidad', async () => {
    respuestas([recordatorioFake()], [{ cargos_pendientes: 2, adeudo: '3000.50' }]);

    await expect(obtenerRecordatorioPendiente(2)).resolves.toEqual({
      id: 5, fecha_envio: '2026-11-06T10:00:00.000Z', cargos_pendientes: 2, adeudo: 3000.5,
    });
    expect(query().mock.calls[1][1]).toEqual([10]);
  });

  it('null si no tiene recordatorios sin ver', async () => {
    respuestas([]);
    await expect(obtenerRecordatorioPendiente(2)).resolves.toBeNull();
  });

  it('si ya pagó todo, lo marca como visto y regresa null', async () => {
    respuestas([recordatorioFake()], [{ cargos_pendientes: 0, adeudo: '0' }], [recordatorioFake({ fecha_visto: 'x' })]);

    await expect(obtenerRecordatorioPendiente(2)).resolves.toBeNull();
    expect(query().mock.calls[2][0]).toMatch(/SET fecha_visto = NOW\(\)/);
    expect(query().mock.calls[2][1]).toEqual([5, 2]);
  });
});

describe('CU-14 recordatorios.service.marcarRecordatorioVisto', () => {
  it('marca como visto un recordatorio del propio residente', async () => {
    respuestas([recordatorioFake({ fecha_visto: '2026-11-06T11:00:00.000Z' })]);
    await expect(marcarRecordatorioVisto(2, '5')).resolves.toMatchObject({ id: 5 });
    expect(query().mock.calls[0][1]).toEqual([5, 2]);
  });

  it('400 con un id inválido', async () => {
    await expect(marcarRecordatorioVisto(2, 'abc')).rejects.toMatchObject({ status: 400 });
  });

  it('404 si no existe, es de otro residente o ya se vio', async () => {
    respuestas([]);
    await expect(marcarRecordatorioVisto(2, 99)).rejects.toMatchObject({ status: 404 });
  });
});

describe('CU-14 recordatorios.repository', () => {
  it('el residente de la unidad debe ser residente y estar activo', async () => {
    respuestas([]);
    await repo.buscarResidenteActivoDeUnidad(10);
    expect(query().mock.calls[0][0]).toMatch(/rol = 'residente' AND u\.activo = TRUE/);
  });

  it('el adeudo solo cuenta cargos pendientes o parciales y resta lo abonado', async () => {
    respuestas([{ cargos_pendientes: 0, adeudo: '0' }]);
    await repo.obtenerAdeudoDeUnidad(10);
    const [sql] = query().mock.calls[0];
    expect(sql).toMatch(/estado IN \('pendiente', 'parcial'\)/);
    expect(sql).toMatch(/c\.monto - COALESCE\(pagado\.total_abonado, 0\)/);
  });

  it('solo busca y marca recordatorios sin ver', async () => {
    respuestas([], []);
    await repo.buscarPendientePorResidente(2);
    await repo.marcarVisto(5, 2);
    expect(query().mock.calls[0][0]).toMatch(/fecha_visto IS NULL/);
    expect(query().mock.calls[1][0]).toMatch(/WHERE id = \$1 AND residente_id = \$2 AND fecha_visto IS NULL/);
  });
});
