// CU-12: Transparencia (publicar y consultar gastos)
// Pruebas unitarias de transparencia.service y de la transacción de transparencia.repository.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('../../src/config/db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

import { pool } from '../../src/config/db.js';
import { publicarTransparencia, listarTransparencia } from '../../src/services/transparencia.service.js';
import * as repo from '../../src/repositories/transparencia.repository.js';

const file = (filename, mimetype = 'image/png', originalname = filename) => ({ filename, mimetype, originalname });
const conceptoOk = (extra = {}) => ({ nombre: 'Banca', mensaje: 'Jardín', monto: 2500, categoria: 'mejoras', ...extra });

// Simula la transacción: cada INSERT de concepto regresa un id distinto y el SUM regresa el total
function simularTransaccion({ total = '2500.00', fallarEn } = {}) {
  let siguienteConcepto = 100;
  vi.mocked(pool.connect).mockResolvedValue(client);
  vi.mocked(client.query).mockImplementation(async (sql) => {
    if (fallarEn && sql.includes(fallarEn)) throw new Error('fallo de BD');
    if (sql.includes('INSERT INTO publicaciones_transparencia')) return { rows: [{ id: 7, titulo: 'Jardín' }] };
    if (sql.includes('INSERT INTO conceptos_gasto')) return { rows: [{ id: siguienteConcepto++ }] };
    if (sql.includes('SUM(monto)')) return { rows: [{ total }] };
    return { rows: [] };
  });
}

function consultas() {
  return vi.mocked(client.query).mock.calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 3).join(' '));
}

beforeEach(() => {
  client.query.mockReset();
  client.release.mockReset();
});

describe('CU-12 publicarTransparencia - validaciones', () => {
  const base = { titulo: 'Jardín', conceptos: [conceptoOk()], autorId: 1 };

  it.each([
    ['sin título', { titulo: '' }, 'El campo "titulo" es obligatorio'],
    ['título solo con espacios', { titulo: '   ' }, 'El campo "titulo" es obligatorio'],
    ['título de más de 150 caracteres', { titulo: 'a'.repeat(151) }, 'El título no puede exceder 150 caracteres'],
    ['descripción que no es texto', { descripcion: 5 }, 'El campo "descripcion" debe ser texto'],
    ['fecha con formato inválido', { fechaGasto: '22/10/2026' }, 'El campo "fecha_gasto" debe ser una fecha válida con formato YYYY-MM-DD'],
    ['fecha inexistente', { fechaGasto: '2026-02-30' }, 'El campo "fecha_gasto" debe ser una fecha válida con formato YYYY-MM-DD'],
    ['sin conceptos', { conceptos: [] }, 'La publicación debe tener al menos un concepto'],
    ['conceptos que no son arreglo', { conceptos: { nombre: 'x' } }, 'La publicación debe tener al menos un concepto'],
    ['concepto sin nombre', { conceptos: [conceptoOk({ nombre: ' ' })] }, 'El concepto 1 debe tener "nombre"'],
    ['concepto sin monto', { conceptos: [conceptoOk({ monto: undefined })] }, 'El monto del concepto 1 debe ser un número mayor a 0'],
    ['monto negativo', { conceptos: [conceptoOk(), conceptoOk({ monto: -5 })] }, 'El monto del concepto 2 debe ser un número mayor a 0'],
    ['monto que redondea a 0', { conceptos: [conceptoOk({ monto: 0.001 })] }, 'El monto del concepto 1 debe ser un número mayor a 0'],
    ['monto mayor al de la columna', { conceptos: [conceptoOk({ monto: 100000000 })] }, 'El monto del concepto 1 no puede ser mayor a 99999999.99'],
    ['categoría inválida', { conceptos: [conceptoOk({ categoria: 'fiestas' })] }, 'La categoría del concepto 1 no es válida. Debe ser una de: mantenimiento, limpieza, seguridad, servicios, mejoras, otros'],
    ['concepto que no es objeto', { conceptos: ['banca'] }, 'El concepto 1 no es válido'],
  ])('rechaza %s con 400 sin tocar la BD', async (_caso, cambios, mensaje) => {
    const error = await publicarTransparencia({ ...base, ...cambios }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toBe(mensaje);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rechaza fotos_N que apunta a un concepto que no existe', async () => {
    const error = await publicarTransparencia({ ...base, archivos: { fotos_3: [file('a.png')] } }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toBe('El campo "fotos_3" hace referencia a un concepto que no existe');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rechaza un campo de archivo desconocido', async () => {
    const error = await publicarTransparencia({ ...base, archivos: { documento: [file('a.pdf')] } }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(error.message).toBe('El campo de archivo "documento" no es válido');
  });
});

describe('CU-12 publicarTransparencia - guardado', () => {
  it('guarda publicación, conceptos y archivos en una transacción y regresa { id, titulo, total }', async () => {
    simularTransaccion({ total: '3700.50' });

    const resultado = await publicarTransparencia({
      titulo: '  Jardín ',
      descripcion: ' Mejoras ',
      fechaGasto: '2026-10-20',
      conceptos: [conceptoOk(), { nombre: 'Pintura', monto: '1200.5' }],
      archivos: {
        fotos_0: [file('u1.png')],
        comprobantes_0: [file('u2.pdf', 'application/pdf', 'factura jardín.pdf')],
        comprobantes_generales: [file('u3.pdf', 'application/pdf')],
      },
      autorId: 1,
    });

    expect(resultado).toEqual({ id: 7, titulo: 'Jardín', total: 3700.5 });
    expect(consultas()).toEqual([
      'BEGIN',
      'INSERT INTO publicaciones_transparencia',
      'INSERT INTO conceptos_gasto',
      'INSERT INTO archivos_transparencia', // foto del concepto 1
      'INSERT INTO archivos_transparencia', // factura del concepto 1
      'INSERT INTO conceptos_gasto',
      'INSERT INTO archivos_transparencia', // comprobante general
      'SELECT COALESCE(SUM(monto), 0)',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);

    const params = vi.mocked(client.query).mock.calls.map(([, p]) => p);
    expect(params[1]).toEqual(['Jardín', 'Mejoras', '2026-10-20', 1]);
    // Concepto sin categoría ni mensaje: 'otros' y null; el monto en texto se convierte a número
    expect(params[5]).toEqual([7, 'Pintura', null, 1200.5, 'otros']);
    // url segura (uuid del disco) y nombre original solo como dato
    expect(params[3]).toEqual([7, 100, 'foto', '/uploads/transparencia/u1.png', 'image/png', 'u1.png']);
    expect(params[4]).toEqual([7, 100, 'comprobante', '/uploads/transparencia/u2.pdf', 'application/pdf', 'factura jardín.pdf']);
    // Comprobante general: concepto_id null
    expect(params[6]).toEqual([7, null, 'comprobante', '/uploads/transparencia/u3.pdf', 'application/pdf', 'u3.pdf']);
  });

  it('si falla un INSERT hace ROLLBACK, libera la conexión y propaga el error', async () => {
    simularTransaccion({ fallarEn: 'INSERT INTO archivos_transparencia' });

    await expect(publicarTransparencia({
      titulo: 'Jardín', conceptos: [conceptoOk()], archivos: { fotos_0: [file('u1.png')] }, autorId: 1,
    })).rejects.toThrow('fallo de BD');

    expect(consultas()).toContain('ROLLBACK');
    expect(consultas()).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('si también falla el ROLLBACK reporta el error original y libera la conexión', async () => {
    vi.mocked(pool.connect).mockResolvedValue(client);
    vi.mocked(client.query).mockImplementation(async (sql) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'ROLLBACK') throw new Error('conexión caída');
      throw new Error('fallo original');
    });

    await expect(publicarTransparencia({ titulo: 'Jardín', conceptos: [conceptoOk()], autorId: 1 }))
      .rejects.toThrow('fallo original');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('sin fecha_gasto deja que la BD use la fecha de hoy', async () => {
    simularTransaccion();

    await publicarTransparencia({ titulo: 'Jardín', conceptos: [conceptoOk()], autorId: 1 });

    const [sql, params] = vi.mocked(client.query).mock.calls[1];
    expect(sql).toMatch(/COALESCE\(\$3::date, CURRENT_DATE\)/);
    expect(params[2]).toBeNull();
  });
});

describe('CU-12 listarTransparencia', () => {
  const fila = (id, extra = {}) => ({
    id, titulo: `Reporte ${id}`, descripcion: null, fecha_gasto: '2026-10-20',
    fecha_publicacion: '2026-10-22T10:00:00.000Z', total: '3700.50', total_registros: '3', ...extra,
  });

  it('arma publicación → conceptos → fotos/comprobantes y comprobantes_generales con 3 consultas', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [fila(1)] })
      .mockResolvedValueOnce({ rows: [
        { id: 10, publicacion_id: 1, nombre: 'Banca', mensaje: 'x', monto: '2500.00', categoria: 'mejoras' },
        { id: 11, publicacion_id: 1, nombre: 'Pintura', mensaje: null, monto: '1200.50', categoria: 'mantenimiento' },
      ] })
      .mockResolvedValueOnce({ rows: [
        { id: 1, publicacion_id: 1, concepto_id: 10, rol: 'foto', url_archivo: '/uploads/transparencia/a.png', mime_type: 'image/png', nombre_original: 'a.png' },
        { id: 2, publicacion_id: 1, concepto_id: 10, rol: 'comprobante', url_archivo: '/uploads/transparencia/b.pdf', mime_type: 'application/pdf', nombre_original: 'b.pdf' },
        { id: 3, publicacion_id: 1, concepto_id: null, rol: 'comprobante', url_archivo: '/uploads/transparencia/c.pdf', mime_type: 'application/pdf', nombre_original: 'c.pdf' },
      ] });

    const resultado = await listarTransparencia({ pagina: 1, limite: 10 });

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(resultado.pagina).toBe(1);
    expect(resultado.total_paginas).toBe(1);
    const [publicacion] = resultado.publicaciones;
    expect(publicacion.total).toBe(3700.5);
    expect(publicacion.conceptos.map((c) => [c.nombre, c.monto, c.fotos.length, c.comprobantes.length]))
      .toEqual([['Banca', 2500, 1, 1], ['Pintura', 1200.5, 0, 0]]);
    expect(publicacion.comprobantes_generales).toEqual([
      { id: 3, url_archivo: '/uploads/transparencia/c.pdf', mime_type: 'application/pdf', nombre_original: 'c.pdf' },
    ]);
    // Las consultas de conceptos y archivos usan ANY($1) con los ids de la página
    expect(vi.mocked(pool.query).mock.calls[1][1]).toEqual([[1]]);
  });

  it('calcula total_paginas con el total de registros y aplica LIMIT/OFFSET', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [fila(5, { total_registros: '23' })] })
      .mockResolvedValue({ rows: [] });

    const resultado = await listarTransparencia({ pagina: 3, limite: 10 });

    expect(resultado.total_paginas).toBe(3);
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([10, 20]);
  });

  it('sin publicaciones regresa lista vacía sin consultar conceptos ni archivos', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await expect(listarTransparencia()).resolves.toEqual({ publicaciones: [], pagina: 1, total_paginas: 0 });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('una página fuera de rango regresa lista vacía con el total real de páginas', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '12' }] });

    await expect(listarTransparencia({ pagina: 9, limite: 10 })).resolves.toEqual({ publicaciones: [], pagina: 9, total_paginas: 2 });
  });

  it('filtra por categoría con EXISTS', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] });

    await listarTransparencia({ categoria: 'mejoras' });

    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/WHERE EXISTS/);
    expect(params).toEqual([10, 0, 'mejoras']);
  });

  it('rechaza una categoría inválida con 400', async () => {
    const error = await listarTransparencia({ categoria: 'fiestas' }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('CU-12 transparencia.repository', () => {
  it('listarPublicaciones ordena de la más reciente a la más antigua y calcula el total con SUM', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] });

    await repo.listarPublicaciones({ limite: 10, offset: 0 });

    const [sql] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toMatch(/SUM\(c\.monto\)/);
    expect(sql).toMatch(/ORDER BY p\.fecha_publicacion DESC/);
    expect(sql).toMatch(/LIMIT \$1 OFFSET \$2/);
  });

  it('contarPublicaciones regresa un número', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ total: '4' }] });

    await expect(repo.contarPublicaciones()).resolves.toBe(4);
  });
});
