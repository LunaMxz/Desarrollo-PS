// CU-12 (Transparencia) - pruebas de la API: POST /transparencia (multipart con multer real)
// y GET /transparencia. Solo se mockean los repositorios: no se necesita BD.
// Los archivos sí se escriben en uploads/transparencia, así se comprueba que no queden huérfanos.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/repositories/transparencia.repository.js');

import app from '../../src/app.js';
import { findById as findUsuarioById } from '../../src/repositories/usuarios.repository.js';
import {
  insertarPublicacion,
  listarPublicaciones,
  contarPublicaciones,
  listarConceptosDePublicaciones,
  listarArchivosDePublicaciones,
} from '../../src/repositories/transparencia.repository.js';
import { admin, residente, findUsuarioPorId, bearer } from '../helpers/fixtures.js';

const DIRECTORIO = path.join('uploads', 'transparencia');
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360f8cfc0f01f0005000201e5274fd20000000049454e44ae426082',
  'hex'
);
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const CONCEPTOS = JSON.stringify([
  { nombre: 'Banca', mensaje: 'Jardín', monto: 2500, categoria: 'mejoras' },
  { nombre: 'Pintura', monto: 1200.5, categoria: 'mantenimiento' },
]);

let archivosAntes;
const archivosEnDisco = () => new Set(fs.existsSync(DIRECTORIO) ? fs.readdirSync(DIRECTORIO) : []);
const archivosNuevos = () => [...archivosEnDisco()].filter((f) => !archivosAntes.has(f));

beforeEach(() => {
  vi.mocked(findUsuarioById).mockImplementation(findUsuarioPorId);
  archivosAntes = archivosEnDisco();
});

afterEach(() => {
  // Limpia lo que hayan dejado los casos exitosos
  for (const f of archivosNuevos()) fs.unlinkSync(path.join(DIRECTORIO, f));
});

function postGasto(token = admin, campos = {}) {
  const req = request(app).post('/transparencia');
  if (token) req.set('Authorization', bearer(token));
  const { titulo = 'Mejoras del jardín', conceptos = CONCEPTOS, fecha_gasto = '2026-10-20' } = campos;
  if (titulo !== null) req.field('titulo', titulo);
  if (conceptos !== null) req.field('conceptos', conceptos);
  if (fecha_gasto !== null) req.field('fecha_gasto', fecha_gasto);
  return req;
}

describe('CU-12 POST /transparencia', () => {
  it('201: el admin publica con fotos y comprobantes; los archivos se guardan con nombre uuid', async () => {
    vi.mocked(insertarPublicacion).mockResolvedValue({ id: 7, titulo: 'Mejoras del jardín', total: '3700.50' });

    const res = await postGasto()
      .attach('fotos_0', PNG, { filename: 'banca.PNG', contentType: 'image/png' })
      .attach('comprobantes_0', PDF, { filename: 'factura jardín.pdf', contentType: 'application/pdf' })
      .attach('comprobantes_1', PNG, { filename: 'ticket.png', contentType: 'image/png' })
      .attach('comprobantes_generales', PDF, { filename: 'general.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Publicación de transparencia creada exitosamente',
      publicacion: { id: 7, titulo: 'Mejoras del jardín', total: 3700.5 },
    });

    const guardado = vi.mocked(insertarPublicacion).mock.calls[0][0];
    expect(guardado.autorId).toBe(admin.id);
    expect(guardado.fechaGasto).toBe('2026-10-20');
    const [banca, pintura] = guardado.conceptos;
    expect(banca.archivos.map((a) => a.rol)).toEqual(['foto', 'comprobante']);
    expect(pintura.archivos.map((a) => a.rol)).toEqual(['comprobante']);
    expect(guardado.comprobantesGenerales).toHaveLength(1);
    // Nombre seguro en disco (uuid + extensión en minúsculas); el original solo como dato, con acentos
    expect(banca.archivos[0].url_archivo).toMatch(/^\/uploads\/transparencia\/[0-9a-f-]{36}\.png$/);
    expect(banca.archivos[1].nombre_original).toBe('factura jardín.pdf');

    expect(archivosNuevos()).toHaveLength(4);
    // El archivo queda disponible por express.static
    const estatico = await request(app).get(banca.archivos[0].url_archivo);
    expect(estatico.status).toBe(200);
  });

  it('400: un .exe se rechaza y no se guarda nada', async () => {
    const res = await postGasto()
      .attach('fotos_0', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El archivo "virus.exe" no es válido: las fotos solo pueden ser JPG o PNG');
    expect(insertarPublicacion).not.toHaveBeenCalled();
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('400: una foto con extensión .png pero tipo PDF se rechaza (se revisan ambos)', async () => {
    const res = await postGasto().attach('fotos_0', PDF, { filename: 'truco.png', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('400: un archivo de más de 5 MB se rechaza y no queda en disco', async () => {
    const res = await postGasto()
      .attach('fotos_0', PNG, { filename: 'ok.png', contentType: 'image/png' })
      .attach('comprobantes_0', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'grande.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El archivo "grande.pdf" excede el tamaño máximo de 5 MB');
    expect(insertarPublicacion).not.toHaveBeenCalled();
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('400: un campo de archivo desconocido se rechaza', async () => {
    const res = await postGasto().attach('documento', PDF, { filename: 'a.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/El campo de archivo "documento" no es válido/);
  });

  it('400: concepto sin monto; borra los archivos que multer ya había guardado', async () => {
    const res = await postGasto(admin, { conceptos: JSON.stringify([{ nombre: 'Banca', categoria: 'otros' }]) })
      .attach('fotos_0', PNG, { filename: 'banca.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El monto del concepto 1 debe ser un número mayor a 0');
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('400: fotos_N de un concepto que no existe; borra los archivos', async () => {
    const res = await postGasto().attach('fotos_5', PNG, { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "fotos_5" hace referencia a un concepto que no existe');
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('400: conceptos con JSON inválido', async () => {
    const res = await postGasto(admin, { conceptos: '[{nombre: Banca' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "conceptos" debe ser un JSON válido');
  });

  it('400: falta el campo conceptos', async () => {
    const res = await postGasto(admin, { conceptos: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "conceptos" es obligatorio');
  });

  it('400: falta el título', async () => {
    const res = await postGasto(admin, { titulo: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo "titulo" es obligatorio');
  });

  it('500: si falla la BD responde error y borra los archivos', async () => {
    vi.mocked(insertarPublicacion).mockRejectedValue(new Error('conexión perdida'));

    const res = await postGasto().attach('fotos_0', PNG, { filename: 'banca.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('403: un residente no puede publicar y no se guarda ningún archivo', async () => {
    const res = await postGasto(residente).attach('fotos_0', PNG, { filename: 'banca.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(insertarPublicacion).not.toHaveBeenCalled();
    expect(archivosNuevos()).toHaveLength(0);
  });

  it('401: sin token', async () => {
    const res = await postGasto(null).attach('fotos_0', PNG, { filename: 'banca.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
    expect(archivosNuevos()).toHaveLength(0);
  });
});

describe('CU-12 GET /transparencia', () => {
  const fila = { id: 1, titulo: 'Jardín', descripcion: null, fecha_gasto: '2026-10-20', fecha_publicacion: '2026-10-22T10:00:00.000Z', total: '2500.00', total_registros: '1' };

  beforeEach(() => {
    vi.mocked(listarConceptosDePublicaciones).mockResolvedValue([
      { id: 10, publicacion_id: 1, nombre: 'Banca', mensaje: null, monto: '2500.00', categoria: 'mejoras' },
    ]);
    vi.mocked(listarArchivosDePublicaciones).mockResolvedValue([
      { id: 1, publicacion_id: 1, concepto_id: 10, rol: 'foto', url_archivo: '/uploads/transparencia/a.png', mime_type: 'image/png', nombre_original: 'a.png' },
    ]);
  });

  it.each([
    ['residente', residente],
    ['admin', admin],
  ])('200: un %s consulta los gastos con su contrato anidado', async (_rol, usuario) => {
    vi.mocked(listarPublicaciones).mockResolvedValue([fila]);

    const res = await request(app).get('/transparencia').set('Authorization', bearer(usuario));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      pagina: 1,
      total_paginas: 1,
      publicaciones: [{
        id: 1, titulo: 'Jardín', descripcion: null, fecha_gasto: '2026-10-20',
        fecha_publicacion: '2026-10-22T10:00:00.000Z', total: 2500,
        conceptos: [{
          id: 10, nombre: 'Banca', mensaje: null, monto: 2500, categoria: 'mejoras',
          fotos: [{ id: 1, url_archivo: '/uploads/transparencia/a.png', mime_type: 'image/png', nombre_original: 'a.png' }],
          comprobantes: [],
        }],
        comprobantes_generales: [],
      }],
    });
  });

  it('por defecto pide la página 1 con 10 resultados', async () => {
    vi.mocked(listarPublicaciones).mockResolvedValue([]);

    await request(app).get('/transparencia').set('Authorization', bearer(residente)).expect(200);

    expect(listarPublicaciones).toHaveBeenCalledWith({ limite: 10, offset: 0, categoria: undefined });
  });

  it('respeta pagina y limite, y limita el máximo a 50', async () => {
    vi.mocked(listarPublicaciones).mockResolvedValue([]);
    vi.mocked(contarPublicaciones).mockResolvedValue(0);

    await request(app).get('/transparencia?pagina=3&limite=500').set('Authorization', bearer(residente)).expect(200);

    expect(listarPublicaciones).toHaveBeenCalledWith({ limite: 50, offset: 100, categoria: undefined });
  });

  it('200: sin publicaciones responde lista vacía, no error', async () => {
    vi.mocked(listarPublicaciones).mockResolvedValue([]);

    const res = await request(app).get('/transparencia').set('Authorization', bearer(residente));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicaciones: [], pagina: 1, total_paginas: 0 });
  });

  it('filtra por categoría', async () => {
    vi.mocked(listarPublicaciones).mockResolvedValue([]);

    await request(app).get('/transparencia?categoria=mejoras').set('Authorization', bearer(residente)).expect(200);

    expect(listarPublicaciones).toHaveBeenCalledWith({ limite: 10, offset: 0, categoria: 'mejoras' });
  });

  it.each([
    ['pagina=0', 'El parámetro "pagina" debe ser un entero mayor a 0'],
    ['pagina=abc', 'El parámetro "pagina" debe ser un entero mayor a 0'],
    ['limite=-1', 'El parámetro "limite" debe ser un entero mayor a 0'],
    ['categoria=fiestas', 'Categoría inválida. Debe ser una de: mantenimiento, limpieza, seguridad, servicios, mejoras, otros'],
  ])('400: %s', async (query, mensaje) => {
    const res = await request(app).get(`/transparencia?${query}`).set('Authorization', bearer(residente));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(mensaje);
  });

  it('401: sin token', async () => {
    const res = await request(app).get('/transparencia');

    expect(res.status).toBe(401);
    expect(listarPublicaciones).not.toHaveBeenCalled();
  });
});
