// CU-14: Reporte de morosidad (GET /cargos/morosidad y /cargos/morosidad/total)
// Pruebas unitarias del service (validación de min_meses, normalización a number)
// y del repository (SQL generado: HAVING condicional, LEFT JOIN a residente, ORDER BY).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import {
  leerMinMeses,
  obtenerReporteAdeudo,
  obtenerTotalAdeudo,
} from '../../src/services/cargos.service.js';
import * as cargosRepo from '../../src/repositories/cargos.repository.js';

// Fila tal como la devuelve obtenerAdeudoPorUnidad (NUMERIC -> string en pg)
function crearFilaAdeudoFake(sobrescribir = {}) {
  return {
    unidad_id: 10,
    unidad_identificador: 'A-101',
    residente_correo: 'residente@condominio.com',
    meses_adeudados: 3,
    adeudo: '4500.00',
    ...sobrescribir,
  };
}

// Respuesta de obtenerTotalPorCobrar tal como la entrega el repository
function responderTotal(total, unidadesCount) {
  vi.mocked(pool.query).mockResolvedValueOnce({
    rows: [{ total, unidades_count: unidadesCount }],
  });
}

describe('CU-14 leerMinMeses', () => {
  it.each([
    ['undefined', undefined],
    ['cadena vacía', ''],
  ])('sin filtro: %s -> undefined', (_caso, valor) => {
    expect(leerMinMeses(valor)).toBeUndefined();
  });

  it.each([
    ['número', 3, 3],
    ['string numérico', '3', 3],
    ['string con espacios', '  5  ', 5],
    ['1 (mínimo)', '1', 1],
  ])('acepta %s', (_caso, entrada, esperado) => {
    expect(leerMinMeses(entrada)).toBe(esperado);
  });

  it.each([
    ['cero', '0'],
    ['negativo', '-1'],
    ['decimal', '2.5'],
    ['no numérico', 'abc'],
    ['NaN literal', 'NaN'],
    ['Infinity', 'Infinity'],
    ['string vacío con espacios', '   '],
  ])('rechaza %s con status 400', (_caso, valor) => {
    const error = (() => {
      try {
        leerMinMeses(valor);
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeDefined();
    expect(error.status).toBe(400);
    expect(error.message).toBe('El parámetro "min_meses" debe ser un entero mayor a 0');
  });
});

describe('CU-14 obtenerReporteAdeudo - service', () => {
  it('convierte el adeudo NUMERIC (string) de cada unidad a number', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        crearFilaAdeudoFake({ unidad_id: 10, adeudo: '4500.00' }),
        crearFilaAdeudoFake({ unidad_id: 12, adeudo: '1500.50' }),
      ],
    });

    const resultado = await obtenerReporteAdeudo();

    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toMatchObject({ unidad_id: 10, adeudo: 4500 });
    expect(resultado[1]).toMatchObject({ unidad_id: 12, adeudo: 1500.5 });
    // El tipo real, no solo el valor (4500 !== "4500")
    expect(typeof resultado[0].adeudo).toBe('number');
  });

  it('respeta el filtro min_meses propagándolo al repository', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await obtenerReporteAdeudo({ minMeses: '3' });

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/HAVING COUNT\(c\.id\) >= \$1/);
    expect(params).toEqual([3]);
  });

  it('sin min_meses no agrega HAVING ni parámetros', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await obtenerReporteAdeudo({ minMeses: '' });

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).not.toMatch(/HAVING/);
    expect(params).toEqual([]);
  });

  it('si nadie debe regresa [] (lista vacía, no error)', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await expect(obtenerReporteAdeudo()).resolves.toEqual([]);
  });

  it('propaga el error 400 de min_meses inválido sin tocar la BD', async () => {
    await expect(obtenerReporteAdeudo({ minMeses: 'abc' })).rejects.toMatchObject({
      status: 400,
      message: 'El parámetro "min_meses" debe ser un entero mayor a 0',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('CU-14 obtenerTotalAdeudo - service', () => {
  it('regresa { total_por_cobrar, unidades } con ambos normalizados a number', async () => {
    responderTotal('12345.67', 2);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        crearFilaAdeudoFake({ adeudo: '10000.00' }),
        crearFilaAdeudoFake({ unidad_id: 12, adeudo: '2345.67' }),
      ],
    });

    const resultado = await obtenerTotalAdeudo();

    expect(resultado.total_por_cobrar).toBe(12345.67);
    expect(typeof resultado.total_por_cobrar).toBe('number');
    expect(resultado.unidades).toHaveLength(2);
    expect(resultado.unidades[0].adeudo).toBe(10000);
    expect(typeof resultado.unidades[0].adeudo).toBe('number');
  });

  it('si nadie debe: { total_por_cobrar: 0, unidades: [] } sin segunda consulta', async () => {
    responderTotal('0', 0);

    const resultado = await obtenerTotalAdeudo();

    expect(resultado).toEqual({ total_por_cobrar: 0, unidades: [] });
    expect(typeof resultado.total_por_cobrar).toBe('number');
    // Solo la consulta del agregado; no se llama obtenerAdeudoPorUnidad
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('convierte un total NUMERIC en string a number', async () => {
    responderTotal('99999999.99', 1);
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [crearFilaAdeudoFake({ adeudo: '99999999.99' })] });

    const { total_por_cobrar } = await obtenerTotalAdeudo();

    expect(total_por_cobrar).toBe(99999999.99);
    expect(typeof total_por_cobrar).toBe('number');
  });
});

describe('CU-14 cargos.repository.obtenerAdeudoPorUnidad - SQL generado', () => {
  it('aplica pendiente/parcial, JOIN unidades, LEFT JOIN pagos y usuarios, GROUP BY y ORDER BY', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await cargosRepo.obtenerAdeudoPorUnidad();

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/FROM cargos c/);
    expect(sql).toMatch(/JOIN unidades u\s+ON u\.id = c\.unidad_id/);
    expect(sql).toMatch(/LEFT JOIN \(\s*SELECT cargo_id, SUM\(monto\) AS total_abonado\s+FROM pagos\s+GROUP BY cargo_id\s*\) pagado/);
    expect(sql).toMatch(/LEFT JOIN usuarios residente/);
    expect(sql).toMatch(/residente\.rol = 'residente'/);
    expect(sql).toMatch(/residente\.activo = TRUE/);
    expect(sql).toMatch(/WHERE c\.estado IN \('pendiente', 'parcial'\)/);
    expect(sql).toMatch(/COUNT\(c\.id\)::int\s+AS meses_adeudados/);
    expect(sql).toMatch(/SUM\(c\.monto - COALESCE\(pagado\.total_abonado, 0\)\)::numeric AS adeudo/);
    expect(sql).toMatch(/GROUP BY u\.id, u\.identificador, residente\.correo/);
    expect(sql).toMatch(/ORDER BY adeudo DESC/);
    expect(sql).not.toMatch(/HAVING/);
    expect(params).toEqual([]);
  });

  it('el LEFT JOIN a residente va con las condiciones en el ON (no en el WHERE), para que aparezcan unidades sin residente activo con correo null', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ residente_correo: null }] });

    const filas = await cargosRepo.obtenerAdeudoPorUnidad();

    const [sql] = vi.mocked(pool.query).mock.calls[0];
    // Las condiciones de residente aparecen antes del WHERE (dentro del ON del LEFT JOIN)
    const indiceResidente = sql.indexOf("residente.rol = 'residente'");
    const indiceWhere = sql.indexOf('WHERE c.estado');
    expect(indiceResidente).toBeGreaterThan(-1);
    expect(indiceResidente).toBeLessThan(indiceWhere);
    expect(filas[0].residente_correo).toBeNull();
  });

  it('con minMeses agrega HAVING con placeholder $1 y lo recibe como parámetro', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await cargosRepo.obtenerAdeudoPorUnidad({ minMeses: 3 });

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/HAVING COUNT\(c\.id\) >= \$1/);
    expect(params).toEqual([3]);
  });
});

describe('CU-14 cargos.repository.obtenerTotalPorCobrar - SQL y forma', () => {
  it('calcula el total con SUM(monto - abonado) y COUNT(DISTINCT unidad_id)', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ total: '0', unidades_count: 0 }] });

    await cargosRepo.obtenerTotalPorCobrar();

    const [sql] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/COALESCE\(SUM\(c\.monto - COALESCE\(pagado\.total_abonado, 0\)\), 0\)::numeric AS total/);
    expect(sql).toMatch(/COUNT\(DISTINCT c\.unidad_id\)::int\s+AS unidades_count/);
    expect(sql).toMatch(/WHERE c\.estado IN \('pendiente', 'parcial'\)/);
  });

  it('si no hay unidades con adeudo regresa { total: "0", unidades: [] } sin llamar al detalle', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ total: '0', unidades_count: 0 }] });

    const resultado = await cargosRepo.obtenerTotalPorCobrar();

    expect(resultado).toEqual({ total: '0', unidades: [] });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('con adeudo regresa el total y delega el detalle a obtenerAdeudoPorUnidad', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ total: '3000.00', unidades_count: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          crearFilaAdeudoFake({ adeudo: '2000.00' }),
          crearFilaAdeudoFake({ unidad_id: 12, adeudo: '1000.00' }),
        ],
      });

    const resultado = await cargosRepo.obtenerTotalPorCobrar();

    expect(resultado.total).toBe('3000.00');
    expect(resultado.unidades).toHaveLength(2);
    // La segunda consulta es la del detalle
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(vi.mocked(pool.query).mock.calls[1][0]).toMatch(/ORDER BY adeudo DESC/);
  });
});