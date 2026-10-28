// CU-13: Balance financiero (GET /transparencia/balance)
// Pruebas unitarias del service (validación de anio/mes, rango del mes, normalización a number,
// "por cobrar" solo para admin), del SQL del repository y del controller (mes actual por defecto).
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import { obtenerBalance } from '../../src/services/transparencia.service.js';
import { obtenerBalanceHandler } from '../../src/controllers/transparencia.controller.js';

// Responde cada consulta según su SQL (las del balance corren en paralelo).
// Los montos van como string porque así regresa pg los NUMERIC.
function simularBD({
  ingresos = '0',
  egresos = '0',
  categorias = [],
  saldo = '0',
  porCobrar = '0',
  unidades = [],
} = {}) {
  // El orden importa: las consultas de cargos (CU-14) y la del saldo también leen de pagos
  vi.mocked(pool.query).mockImplementation(async (sql) => {
    if (sql.includes('unidades_count')) return { rows: [{ total: porCobrar, unidades_count: unidades.length }] };
    if (sql.includes('ORDER BY adeudo DESC')) return { rows: unidades };
    if (sql.includes('AS saldo')) return { rows: [{ saldo }] };
    if (sql.includes('GROUP BY cg.categoria')) return { rows: categorias };
    if (sql.includes('FROM pagos')) return { rows: [{ total: ingresos }] };
    if (sql.includes('FROM conceptos_gasto cg')) return { rows: [{ total: egresos }] };
    throw new Error(`Consulta no esperada: ${sql}`);
  });
}

function llamadaCon(fragmento) {
  return vi.mocked(pool.query).mock.calls.find(([sql]) => sql.includes(fragmento));
}

function capturarError(fn) {
  return fn().then(
    () => undefined,
    (e) => e
  );
}

describe('CU-13 obtenerBalance - validación de anio y mes', () => {
  it.each([
    ['2 dígitos', '26'],
    ['5 dígitos', '20266'],
    ['empieza en 0', '0999'],
    ['no numérico', 'abc'],
    ['decimal', '2026.5'],
    ['negativo', '-2026'],
  ])('rechaza anio %s con 400 sin tocar la BD', async (_caso, anio) => {
    const error = await capturarError(() => obtenerBalance({ anio, mes: '10' }));

    expect(error.status).toBe(400);
    expect(error.message).toBe('El parámetro "anio" debe ser un año de 4 dígitos (ej. 2026)');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it.each([
    ['cero', '0'],
    ['13', '13'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['no numérico', 'oct'],
    ['3 dígitos', '010'],
  ])('rechaza mes %s con 400 sin tocar la BD', async (_caso, mes) => {
    const error = await capturarError(() => obtenerBalance({ anio: '2026', mes }));

    expect(error.status).toBe(400);
    expect(error.message).toBe('El parámetro "mes" debe ser un número entero entre 1 y 12');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it.each([
    ['strings', '2026', '3'],
    ['mes con cero a la izquierda', '2026', '03'],
    ['con espacios', ' 2026 ', ' 3 '],
    ['números (mes actual del controller)', 2026, 3],
  ])('acepta %s', async (_caso, anio, mes) => {
    simularBD();

    const balance = await obtenerBalance({ anio, mes });

    expect(balance).toMatchObject({ anio: 2026, mes: 3 });
  });
});

describe('CU-13 obtenerBalance - cálculo del mes', () => {
  it('convierte los NUMERIC (string) a number y calcula el saldo del mes', async () => {
    simularBD({
      ingresos: '1500.10',
      egresos: '300.05',
      saldo: '8200.50',
      categorias: [
        { categoria: 'mantenimiento', total: '200.05' },
        { categoria: 'limpieza', total: '100.00' },
      ],
    });

    const balance = await obtenerBalance({ anio: '2026', mes: '10' });

    expect(balance).toEqual({
      anio: 2026,
      mes: 10,
      ingresos: 1500.1,
      egresos: 300.05,
      // Sin redondeo daría 1200.0499999999997
      saldo_mes: 1200.05,
      saldo_acumulado: 8200.5,
      egresos_por_categoria: [
        { categoria: 'mantenimiento', total: 200.05 },
        { categoria: 'limpieza', total: 100 },
      ],
    });
    expect(typeof balance.ingresos).toBe('number');
    expect(typeof balance.egresos_por_categoria[0].total).toBe('number');
  });

  it('un mes sin movimientos regresa ceros y categorías vacías (sin error)', async () => {
    simularBD();

    const balance = await obtenerBalance({ anio: '2020', mes: '1' });

    expect(balance).toEqual({
      anio: 2020,
      mes: 1,
      ingresos: 0,
      egresos: 0,
      saldo_mes: 0,
      saldo_acumulado: 0,
      egresos_por_categoria: [],
    });
  });

  it('el saldo del mes puede ser negativo si se gastó más de lo cobrado', async () => {
    simularBD({ ingresos: '1000.00', egresos: '2500.00', saldo: '-500.00' });

    const balance = await obtenerBalance({ anio: '2026', mes: '10' });

    expect(balance.saldo_mes).toBe(-1500);
    expect(balance.saldo_acumulado).toBe(-500);
  });
});

describe('CU-13 obtenerBalance - "por cobrar" según el rol', () => {
  const unidadesConAdeudo = [
    { unidad_id: 10, unidad_identificador: 'A-101', adeudo: '2000.00' },
    { unidad_id: 12, unidad_identificador: 'B-202', adeudo: '1500.50' },
  ];

  it('el admin recibe por_cobrar y unidades_con_adeudo como number', async () => {
    simularBD({ porCobrar: '3500.50', unidades: unidadesConAdeudo });

    const balance = await obtenerBalance({ anio: '2026', mes: '10', esAdmin: true });

    expect(balance.por_cobrar).toBe(3500.5);
    expect(balance.unidades_con_adeudo).toBe(2);
  });

  it('el admin recibe ceros si nadie debe', async () => {
    simularBD();

    const balance = await obtenerBalance({ anio: '2026', mes: '10', esAdmin: true });

    expect(balance.por_cobrar).toBe(0);
    expect(balance.unidades_con_adeudo).toBe(0);
  });

  it('el residente no recibe por_cobrar ni unidades_con_adeudo, y no se consultan los cargos', async () => {
    simularBD({ porCobrar: '3500.50', unidades: unidadesConAdeudo });

    const balance = await obtenerBalance({ anio: '2026', mes: '10', esAdmin: false });

    expect(balance).not.toHaveProperty('por_cobrar');
    expect(balance).not.toHaveProperty('unidades_con_adeudo');
    expect(llamadaCon('FROM cargos')).toBeUndefined();
  });
});

describe('CU-13 transparencia.repository - SQL del balance', () => {
  it('filtra el mes con el rango [inicio, siguiente mes) y no con LIKE', async () => {
    simularBD();

    await obtenerBalance({ anio: '2026', mes: '10' });

    const [sqlIngresos, paramsIngresos] = llamadaCon('fecha_pago >=');
    expect(sqlIngresos).toMatch(/COALESCE\(SUM\(monto\), 0\) AS total/);
    expect(sqlIngresos).toMatch(/fecha_pago >= \$1::date AND fecha_pago < \$2::date/);
    expect(paramsIngresos).toEqual(['2026-10-01', '2026-11-01']);

    const [sqlEgresos, paramsEgresos] = vi.mocked(pool.query).mock.calls.find(
      ([sql]) => sql.includes('p.fecha_gasto >=') && !sql.includes('GROUP BY')
    );
    expect(sqlEgresos).toMatch(/COALESCE\(SUM\(cg\.monto\), 0\) AS total/);
    expect(sqlEgresos).toMatch(/JOIN publicaciones_transparencia p ON p\.id = cg\.publicacion_id/);
    expect(paramsEgresos).toEqual(['2026-10-01', '2026-11-01']);

    const [sqlCategorias, paramsCategorias] = llamadaCon('GROUP BY cg.categoria');
    expect(sqlCategorias).toMatch(/p\.fecha_gasto >= \$1::date AND p\.fecha_gasto < \$2::date/);
    expect(paramsCategorias).toEqual(['2026-10-01', '2026-11-01']);

    for (const [sql] of vi.mocked(pool.query).mock.calls) {
      expect(sql).not.toMatch(/LIKE/i);
    }
  });

  it('diciembre termina el 1 de enero del año siguiente', async () => {
    simularBD();

    await obtenerBalance({ anio: '2026', mes: '12' });

    expect(llamadaCon('fecha_pago >=')[1]).toEqual(['2026-12-01', '2027-01-01']);
    expect(llamadaCon('AS saldo')[1]).toEqual(['2027-01-01']);
  });

  it('el saldo acumulado resta todos los egresos de todos los pagos hasta el fin del mes', async () => {
    simularBD();

    await obtenerBalance({ anio: '2026', mes: '3' });

    const [sql, params] = llamadaCon('AS saldo');
    expect(sql).toMatch(/FROM pagos\s+WHERE fecha_pago < \$1::date/);
    expect(sql).toMatch(/WHERE p\.fecha_gasto < \$1::date\) AS saldo/);
    // Sin límite inferior: incluye todo lo anterior al mes
    expect(sql).not.toMatch(/>=/);
    expect(params).toEqual(['2026-04-01']);
  });
});

describe('CU-13 obtenerBalanceHandler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function crearRes() {
    return { json: vi.fn() };
  }

  it('sin anio ni mes usa el mes actual', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 15)); // 15 de marzo de 2026
    simularBD();
    const res = crearRes();
    const next = vi.fn();

    await obtenerBalanceHandler({ query: {}, user: { rol: 'residente' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ anio: 2026, mes: 3 }));
    expect(llamadaCon('fecha_pago >=')[1]).toEqual(['2026-03-01', '2026-04-01']);
  });

  it('usa anio y mes del query y le da "por cobrar" al admin', async () => {
    simularBD({ porCobrar: '1000.00', unidades: [{ unidad_id: 1, adeudo: '1000.00' }] });
    const res = crearRes();

    await obtenerBalanceHandler({ query: { anio: '2025', mes: '7' }, user: { rol: 'admin' } }, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ anio: 2025, mes: 7, por_cobrar: 1000, unidades_con_adeudo: 1 })
    );
  });

  it('el residente no recibe "por cobrar"', async () => {
    simularBD({ porCobrar: '1000.00', unidades: [{ unidad_id: 1, adeudo: '1000.00' }] });
    const res = crearRes();

    await obtenerBalanceHandler({ query: { anio: '2025', mes: '7' }, user: { rol: 'residente' } }, res, vi.fn());

    const balance = res.json.mock.calls[0][0];
    expect(balance).not.toHaveProperty('por_cobrar');
    expect(balance).not.toHaveProperty('unidades_con_adeudo');
  });

  it('manda el error 400 a next si el mes es inválido', async () => {
    const res = crearRes();
    const next = vi.fn();

    await obtenerBalanceHandler({ query: { anio: '2026', mes: '13' }, user: { rol: 'admin' } }, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });
});
