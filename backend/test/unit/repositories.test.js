// Repositorios: se mockea pool.query (no se necesita BD).
// Se verifica qué parámetros reciben las consultas y cómo se transforma el resultado.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import * as cargosRepo from '../../src/repositories/cargos.repository.js';
import * as incidenciasRepo from '../../src/repositories/incidencias.repository.js';
import * as pagosRepo from '../../src/repositories/pagos.repository.js';
import * as unidadesRepo from '../../src/repositories/unidades.repository.js';
import * as usuariosRepo from '../../src/repositories/usuarios.repository.js';

// Devuelve [sql, params] de la última llamada a pool.query
function ultimaConsulta() {
  return vi.mocked(pool.query).mock.calls.at(-1);
}

function responder(rows) {
  vi.mocked(pool.query).mockResolvedValue({ rows });
}

beforeEach(() => {
  responder([]);
});

describe('cargos.repository', () => {
  it('insertarCargo inserta en estado pendiente y regresa el cargo', async () => {
    responder([{ id: 1, estado: 'pendiente' }]);

    const cargo = await cargosRepo.insertarCargo({ unidad_id: 10, concepto: 'Cuota mensual', monto: 1500, periodo: '2026-10' });

    const [sql, params] = ultimaConsulta();
    expect(sql).toMatch(/INSERT INTO cargos/);
    expect(sql).toMatch(/'pendiente'/);
    expect(params).toEqual([10, 'Cuota mensual', 1500, '2026-10']);
    expect(cargo).toEqual({ id: 1, estado: 'pendiente' });
  });
});

describe('unidades.repository', () => {
  it('findUnidadById regresa la unidad o null', async () => {
    responder([{ id: 5, identificador: 'A-101' }]);
    expect(await unidadesRepo.findUnidadById(5)).toEqual({ id: 5, identificador: 'A-101' });
    expect(ultimaConsulta()[1]).toEqual([5]);

    responder([]);
    expect(await unidadesRepo.findUnidadById(99)).toBeNull();
  });

  it('obtenerUnidadesConResidenteActivo filtra residentes activos', async () => {
    responder([{ id: 5 }, { id: 6 }]);

    const unidades = await unidadesRepo.obtenerUnidadesConResidenteActivo();

    expect(ultimaConsulta()[0]).toMatch(/u\.rol = 'residente'[\s\S]*u\.activo = true/);
    expect(unidades).toHaveLength(2);
  });
});

describe('pagos.repository', () => {
  it('listarCargosPendientesOParciales calcula pagado y saldo por cargo', async () => {
    responder([{ id: 1, total_pagado: '500.00', saldo_pendiente: '1000.00' }]);

    const cargos = await pagosRepo.listarCargosPendientesOParciales(10);

    const [sql, params] = ultimaConsulta();
    expect(sql).toMatch(/estado IN \('pendiente', 'parcial'\)/);
    expect(sql).toMatch(/saldo_pendiente/);
    expect(params).toEqual([10]);
    expect(cargos).toHaveLength(1);
  });

  it('insertarPago usa NOW() si no se manda fecha', async () => {
    responder([{ id: 7 }]);

    const pago = await pagosRepo.insertarPago({ cargoId: 1, monto: 500, registradoPor: 2 });

    expect(ultimaConsulta()[0]).toMatch(/COALESCE\(\$3, NOW\(\)\)/);
    expect(ultimaConsulta()[1]).toEqual([1, 500, null, 2]);
    expect(pago).toEqual({ id: 7 });
  });

  it('insertarPago respeta la fecha enviada', async () => {
    await pagosRepo.insertarPago({ cargoId: 1, monto: 500, fechaPago: '2026-10-01', registradoPor: 2 });

    expect(ultimaConsulta()[1]).toEqual([1, 500, '2026-10-01', 2]);
  });

  it('sumarPagosDeCargo regresa el total', async () => {
    responder([{ total: '800.00' }]);

    expect(await pagosRepo.sumarPagosDeCargo(1)).toBe('800.00');
    expect(ultimaConsulta()[1]).toEqual([1]);
  });

  it('obtenerCargosPorUnidad regresa todos los cargos de la unidad', async () => {
    responder([{ id: 1 }, { id: 2 }]);

    expect(await pagosRepo.obtenerCargosPorUnidad(10)).toHaveLength(2);
    expect(ultimaConsulta()[1]).toEqual([10]);
  });

  it('findCargoById regresa el cargo o null', async () => {
    responder([{ id: 1 }]);
    expect(await pagosRepo.findCargoById(1)).toEqual({ id: 1 });

    responder([]);
    expect(await pagosRepo.findCargoById(99)).toBeNull();
  });

  it('actualizarEstadoCargo manda estado e id en ese orden', async () => {
    responder([{ id: 1, estado: 'pagado' }]);

    expect(await pagosRepo.actualizarEstadoCargo(1, 'pagado')).toEqual({ id: 1, estado: 'pagado' });
    expect(ultimaConsulta()[1]).toEqual(['pagado', 1]);

    responder([]);
    expect(await pagosRepo.actualizarEstadoCargo(99, 'pagado')).toBeNull();
  });

  it('obtenerCargosConPagosPorUnidad usa LEFT JOIN para conservar cargos sin pagos', async () => {
    responder([{ cargo_id: 1, pago_id: null }]);

    const filas = await pagosRepo.obtenerCargosConPagosPorUnidad(10);

    expect(ultimaConsulta()[0]).toMatch(/LEFT JOIN pagos/);
    expect(ultimaConsulta()[1]).toEqual([10]);
    expect(filas).toEqual([{ cargo_id: 1, pago_id: null }]);
  });
});

describe('incidencias.repository', () => {
  it('actualizarResponsableYEstado manda null en lo que no cambia', async () => {
    responder([{ id: 1, responsable: 'Plomero' }]);

    const incidencia = await incidenciasRepo.actualizarResponsableYEstado(1, { responsable: 'Plomero' });

    expect(ultimaConsulta()[1]).toEqual([1, 'Plomero', null]);
    expect(incidencia).toEqual({ id: 1, responsable: 'Plomero' });
  });

  it('actualizarResponsableYEstado regresa null si no existe (y acepta sin opciones)', async () => {
    expect(await incidenciasRepo.actualizarResponsableYEstado(99)).toBeNull();
    expect(ultimaConsulta()[1]).toEqual([99, null, null]);
  });

  it('findById regresa la incidencia o null', async () => {
    responder([{ id: 1 }]);
    expect(await incidenciasRepo.findById(1)).toEqual({ id: 1 });

    responder([]);
    expect(await incidenciasRepo.findById(99)).toBeNull();
  });

  it('resolverIncidenciaInDB marca resuelto con fecha de resolución', async () => {
    responder([{ id: 1, estado: 'resuelto' }]);

    expect(await incidenciasRepo.resolverIncidenciaInDB(1)).toEqual({ id: 1, estado: 'resuelto' });
    expect(ultimaConsulta()[0]).toMatch(/estado = 'resuelto', fecha_resolucion = NOW\(\)/);

    responder([]);
    expect(await incidenciasRepo.resolverIncidenciaInDB(99)).toBeNull();
  });

  it('insertarIncidencia inicia en abierto y la ubicación es opcional', async () => {
    responder([{ id: 1, estado: 'abierto' }]);

    await incidenciasRepo.insertarIncidencia({ residente_id: 2, titulo: 'Fuga', descripcion: 'Hay agua' });

    expect(ultimaConsulta()[0]).toMatch(/'abierto'/);
    expect(ultimaConsulta()[1]).toEqual([2, 'Fuga', 'Hay agua', null]);
  });

  it('listar sin filtro ordena por fecha de creación', async () => {
    await incidenciasRepo.listar();

    const [sql, params] = ultimaConsulta();
    expect(sql).not.toMatch(/WHERE/);
    expect(sql).toMatch(/ORDER BY fecha_creacion DESC/);
    expect(params).toEqual([]);
  });

  it('listar filtra por estado', async () => {
    await incidenciasRepo.listar({ estado: 'abierto' });

    const [sql, params] = ultimaConsulta();
    expect(sql).toMatch(/WHERE estado = \$1/);
    expect(params).toEqual(['abierto']);
  });

  it('listar de resueltas ordena por la resolución más reciente', async () => {
    await incidenciasRepo.listar({ estado: 'resuelto' });

    expect(ultimaConsulta()[0]).toMatch(/ORDER BY fecha_resolucion DESC NULLS LAST/);
  });
});

describe('usuarios.repository', () => {
  it('findByCorreo incluye el hash (para el login) o regresa null', async () => {
    responder([{ id: 1, password_hash: 'hash' }]);
    expect(await usuariosRepo.findByCorreo('a@a.com')).toEqual({ id: 1, password_hash: 'hash' });
    expect(ultimaConsulta()[0]).toMatch(/password_hash/);

    responder([]);
    expect(await usuariosRepo.findByCorreo('no@a.com')).toBeNull();
  });

  it('findById no expone el hash de la contraseña', async () => {
    responder([{ id: 1 }]);

    expect(await usuariosRepo.findById(1)).toEqual({ id: 1 });
    expect(ultimaConsulta()[0]).not.toMatch(/password_hash/);

    responder([]);
    expect(await usuariosRepo.findById(99)).toBeNull();
  });

  it('isActive regresa true solo si activo es true', async () => {
    responder([{ activo: true }]);
    expect(await usuariosRepo.isActive(1)).toBe(true);

    responder([{ activo: false }]);
    expect(await usuariosRepo.isActive(1)).toBe(false);

    responder([]);
    expect(await usuariosRepo.isActive(99)).toBe(false);
  });

  it('verificarUnidadTieneResidenteActivo', async () => {
    responder([{ id: 1 }]);
    expect(await usuariosRepo.verificarUnidadTieneResidenteActivo(5)).toBe(true);

    responder([]);
    expect(await usuariosRepo.verificarUnidadTieneResidenteActivo(5)).toBe(false);
  });

  it('crearUsuario lo crea activo', async () => {
    responder([{ id: 3, activo: true }]);

    const usuario = await usuariosRepo.crearUsuario({ correo: 'n@a.com', passwordHash: 'h', rol: 'residente', unidadId: 5 });

    expect(ultimaConsulta()[1]).toEqual(['n@a.com', 'h', 'residente', 5]);
    expect(usuario).toEqual({ id: 3, activo: true });
  });

  it('desactivarUsuario hace soft delete (activo = false), no DELETE', async () => {
    responder([{ id: 3, activo: false }]);

    expect(await usuariosRepo.desactivarUsuario(3)).toEqual({ id: 3, activo: false });
    expect(ultimaConsulta()[0]).toMatch(/SET activo = false/);
    expect(ultimaConsulta()[0]).not.toMatch(/DELETE/);

    responder([]);
    expect(await usuariosRepo.desactivarUsuario(99)).toBeNull();
  });

  it('obtenerResidentes filtra activos por defecto', async () => {
    await usuariosRepo.obtenerResidentes();
    expect(ultimaConsulta()[0]).toMatch(/u\.activo = true/);

    await usuariosRepo.obtenerResidentes({ soloActivos: false });
    expect(ultimaConsulta()[0]).not.toMatch(/u\.activo = true/);
  });

  it('obtenerResidenteConUnidad regresa el residente o null', async () => {
    responder([{ id: 2, unidad_identificador: 'A-101' }]);
    expect(await usuariosRepo.obtenerResidenteConUnidad(2)).toEqual({ id: 2, unidad_identificador: 'A-101' });

    responder([]);
    expect(await usuariosRepo.obtenerResidenteConUnidad(99)).toBeNull();
  });

  it('actualizarRol manda rol e id en ese orden', async () => {
    responder([{ id: 2, rol: 'admin' }]);

    expect(await usuariosRepo.actualizarRol(2, 'admin')).toEqual({ id: 2, rol: 'admin' });
    expect(ultimaConsulta()[1]).toEqual(['admin', 2]);

    responder([]);
    expect(await usuariosRepo.actualizarRol(99, 'admin')).toBeNull();
  });
});
