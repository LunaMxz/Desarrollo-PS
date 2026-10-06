// CU-06: Generar cargo mensual (administrador)
// Pruebas unitarias de cargos.service.generarCargosMensuales.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/repositories/cargos.repository.js');
vi.mock('../../src/repositories/unidades.repository.js');

import { generarCargosMensuales } from '../../src/services/cargos.service.js';
import { insertarCargo } from '../../src/repositories/cargos.repository.js';
import { obtenerUnidadesConResidenteActivo } from '../../src/repositories/unidades.repository.js';
import { crearCargoFake, errorCargoDuplicado } from '../helpers/fixtures.js';

const unidades = [
  { id: 10, identificador: 'Depto 101' },
  { id: 12, identificador: 'Depto 102' },
];

beforeEach(() => {
  // Fecha fija (hora local): el periodo actual es '2026-10'
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
  vi.mocked(obtenerUnidadesConResidenteActivo).mockResolvedValue(unidades);
  vi.mocked(insertarCargo).mockImplementation(async (datos) =>
    crearCargoFake({ ...datos, monto: datos.monto.toFixed(2) })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CU-06 Generar cargo mensual - cargos.service.generarCargosMensuales', () => {
  it('genera un cargo por cada unidad con residente activo para el periodo actual', async () => {
    const resultado = await generarCargosMensuales({ monto: 1500 });

    expect(insertarCargo).toHaveBeenCalledTimes(2);
    expect(insertarCargo).toHaveBeenCalledWith({ unidad_id: 10, concepto: 'Cuota mensual', monto: 1500, periodo: '2026-10' });
    expect(insertarCargo).toHaveBeenCalledWith({ unidad_id: 12, concepto: 'Cuota mensual', monto: 1500, periodo: '2026-10' });
    expect(resultado.periodo).toBe('2026-10');
    expect(resultado.cargos).toHaveLength(2);
    expect(resultado.omitidas).toEqual([]);
  });

  it('el periodo siempre tiene el mes con dos dígitos (YYYY-MM)', async () => {
    vi.setSystemTime(new Date(2027, 0, 31, 23, 0, 0));

    const resultado = await generarCargosMensuales({ monto: 1500 });

    expect(resultado.periodo).toBe('2027-01');
    expect(vi.mocked(insertarCargo).mock.calls[0][0].periodo).toBe('2027-01');
  });

  it('acepta el monto como texto numérico (input del frontend)', async () => {
    await generarCargosMensuales({ monto: '1500.50' });

    expect(vi.mocked(insertarCargo).mock.calls[0][0].monto).toBe(1500.5);
  });

  it('usa el concepto enviado (sin espacios) o "Cuota mensual" si viene vacío', async () => {
    await generarCargosMensuales({ monto: 1500, concepto: '  Cuota extraordinaria  ' });
    expect(vi.mocked(insertarCargo).mock.calls[0][0].concepto).toBe('Cuota extraordinaria');

    vi.mocked(insertarCargo).mockClear();
    await generarCargosMensuales({ monto: 1500, concepto: '   ' });
    expect(vi.mocked(insertarCargo).mock.calls[0][0].concepto).toBe('Cuota mensual');
  });

  it('omite (sin fallar) las unidades que ya tienen cargo en el periodo y las reporta', async () => {
    vi.mocked(insertarCargo)
      .mockRejectedValueOnce(errorCargoDuplicado())
      .mockResolvedValueOnce(crearCargoFake({ unidad_id: 12 }));

    const resultado = await generarCargosMensuales({ monto: 1500 });

    expect(resultado.cargos).toEqual([crearCargoFake({ unidad_id: 12 })]);
    expect(resultado.omitidas).toEqual([{ unidad_id: 10, identificador: 'Depto 101' }]);
  });

  it('lanza 409 si todas las unidades ya tenían su cargo (generar dos veces el mismo mes)', async () => {
    vi.mocked(insertarCargo).mockRejectedValue(errorCargoDuplicado());

    await expect(generarCargosMensuales({ monto: 1500 })).rejects.toMatchObject({
      message: 'Los cargos del periodo 2026-10 ya fueron generados para todas las unidades con residente activo',
      status: 409,
    });
  });

  it('no genera nada si no hay unidades con residente activo', async () => {
    vi.mocked(obtenerUnidadesConResidenteActivo).mockResolvedValue([]);

    const resultado = await generarCargosMensuales({ monto: 1500 });

    expect(resultado).toEqual({ periodo: '2026-10', cargos: [], omitidas: [] });
    expect(insertarCargo).not.toHaveBeenCalled();
  });

  it('propaga cualquier otro error de la BD', async () => {
    const errorBD = Object.assign(new Error('connection terminated'), { code: '57P01' });
    vi.mocked(insertarCargo).mockRejectedValue(errorBD);

    await expect(generarCargosMensuales({ monto: 1500 })).rejects.toBe(errorBD);
  });

  it.each([0, -100, 'abc', null, undefined])('lanza 400 si el monto es inválido (%s)', async (monto) => {
    await expect(generarCargosMensuales({ monto })).rejects.toMatchObject({
      message: 'El monto debe ser un número mayor a 0',
      status: 400,
    });
    expect(obtenerUnidadesConResidenteActivo).not.toHaveBeenCalled();
    expect(insertarCargo).not.toHaveBeenCalled();
  });

  it('lanza 400 si el monto excede lo que soporta la columna NUMERIC(10,2)', async () => {
    await expect(generarCargosMensuales({ monto: 100000000 })).rejects.toMatchObject({ status: 400 });
    expect(insertarCargo).not.toHaveBeenCalled();
  });

  it('lanza 400 si el concepto no es texto', async () => {
    await expect(generarCargosMensuales({ monto: 1500, concepto: 123 })).rejects.toMatchObject({
      message: 'El campo "concepto" debe ser texto',
      status: 400,
    });
  });

  it('lanza 400 si el concepto excede 100 caracteres', async () => {
    await expect(generarCargosMensuales({ monto: 1500, concepto: 'x'.repeat(101) })).rejects.toMatchObject({
      message: 'El concepto no puede exceder 100 caracteres',
      status: 400,
    });
    expect(insertarCargo).not.toHaveBeenCalled();
  });
});
