import {
  insertarPublicacion,
  listarPublicaciones,
  contarPublicaciones,
  listarConceptosDePublicaciones,
  listarArchivosDePublicaciones,
} from '../repositories/transparencia.repository.js';

const CATEGORIAS_GASTO = ['mantenimiento', 'limpieza', 'seguridad', 'servicios', 'mejoras', 'otros'];
const MAX_TEXTO = 150; // titulo, nombre del concepto y nombre_original son VARCHAR(150) en la BD
const MAX_MONTO = 99999999.99; // monto es NUMERIC(10,2) en la BD
const URL_UPLOADS = '/uploads/transparencia';

function errorValidacion(mensaje) {
  const error = new Error(mensaje);
  error.status = 400;
  return error;
}

function esFechaValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
}

// "n" es la posición del concepto contando desde 1 (para los mensajes de error)
function validarConcepto(concepto, n) {
  if (!concepto || typeof concepto !== 'object' || Array.isArray(concepto)) {
    throw errorValidacion(`El concepto ${n} no es válido`);
  }
  const { nombre, mensaje, monto, categoria } = concepto;
  if (typeof nombre !== 'string' || !nombre.trim()) {
    throw errorValidacion(`El concepto ${n} debe tener "nombre"`);
  }
  if (nombre.trim().length > MAX_TEXTO) {
    throw errorValidacion(`El nombre del concepto ${n} no puede exceder ${MAX_TEXTO} caracteres`);
  }
  if (mensaje !== undefined && mensaje !== null && typeof mensaje !== 'string') {
    throw errorValidacion(`El mensaje del concepto ${n} debe ser texto`);
  }
  // Se redondea a centavos antes de validar: 0.001 no debe pasar como monto mayor a 0
  const montoNum = typeof monto === 'number' || typeof monto === 'string'
    ? Math.round(Number(monto) * 100) / 100
    : Number.NaN;
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    throw errorValidacion(`El monto del concepto ${n} debe ser un número mayor a 0`);
  }
  if (montoNum > MAX_MONTO) {
    throw errorValidacion(`El monto del concepto ${n} no puede ser mayor a ${MAX_MONTO}`);
  }
  if (categoria !== undefined && categoria !== null && !CATEGORIAS_GASTO.includes(categoria)) {
    throw errorValidacion(`La categoría del concepto ${n} no es válida. Debe ser una de: ${CATEGORIAS_GASTO.join(', ')}`);
  }
  return {
    nombre: nombre.trim(),
    mensaje: mensaje?.trim() || null,
    monto: montoNum,
    categoria: categoria ?? 'otros',
    archivos: [],
  };
}

function aArchivo(file, rol) {
  return {
    rol,
    url_archivo: `${URL_UPLOADS}/${file.filename}`,
    mime_type: file.mimetype,
    nombre_original: file.originalname.slice(0, MAX_TEXTO),
  };
}

// fotos_N y comprobantes_N usan el índice del concepto en el arreglo (empieza en 0).
// Agrega cada archivo a su concepto y regresa los comprobantes generales.
function asignarArchivos(conceptos, archivos) {
  const comprobantesGenerales = [];
  for (const [campo, files] of Object.entries(archivos)) {
    if (campo === 'comprobantes_generales') {
      comprobantesGenerales.push(...files.map((file) => aArchivo(file, 'comprobante')));
      continue;
    }
    const coincidencia = /^(fotos|comprobantes)_(\d+)$/.exec(campo);
    if (!coincidencia) {
      throw errorValidacion(`El campo de archivo "${campo}" no es válido`);
    }
    const concepto = conceptos[Number(coincidencia[2])];
    if (!concepto) {
      throw errorValidacion(`El campo "${campo}" hace referencia a un concepto que no existe`);
    }
    const rol = coincidencia[1] === 'fotos' ? 'foto' : 'comprobante';
    concepto.archivos.push(...files.map((file) => aArchivo(file, rol)));
  }
  return comprobantesGenerales;
}

// CU-12: el admin publica un reporte de gasto con sus conceptos, fotos y comprobantes.
// "archivos" viene agrupado por campo (upload.middleware): { fotos_0: [...], comprobantes_generales: [...] }
export async function publicarTransparencia({ titulo, descripcion, fechaGasto, conceptos, archivos = {}, autorId } = {}) {
  if (typeof titulo !== 'string' || !titulo.trim()) {
    throw errorValidacion('El campo "titulo" es obligatorio');
  }
  if (titulo.trim().length > MAX_TEXTO) {
    throw errorValidacion(`El título no puede exceder ${MAX_TEXTO} caracteres`);
  }
  if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
    throw errorValidacion('El campo "descripcion" debe ser texto');
  }
  if (fechaGasto && (typeof fechaGasto !== 'string' || !esFechaValida(fechaGasto))) {
    throw errorValidacion('El campo "fecha_gasto" debe ser una fecha válida con formato YYYY-MM-DD');
  }
  if (!Array.isArray(conceptos) || conceptos.length === 0) {
    throw errorValidacion('La publicación debe tener al menos un concepto');
  }
  const conceptosValidos = conceptos.map((concepto, i) => validarConcepto(concepto, i + 1));
  const comprobantesGenerales = asignarArchivos(conceptosValidos, archivos);

  const publicacion = await insertarPublicacion({
    titulo: titulo.trim(),
    descripcion: descripcion?.trim() || null,
    fechaGasto: fechaGasto || null,
    autorId,
    conceptos: conceptosValidos,
    comprobantesGenerales,
  });
  return { id: publicacion.id, titulo: publicacion.titulo, total: Number(publicacion.total) };
}

// CU-12: listado paginado para admin y residentes (solo lectura).
// Arma publicación -> conceptos -> fotos/comprobantes, más comprobantes_generales.
export async function listarTransparencia({ pagina = 1, limite = 10, categoria } = {}) {
  if (categoria !== undefined && !CATEGORIAS_GASTO.includes(categoria)) {
    throw errorValidacion(`Categoría inválida. Debe ser una de: ${CATEGORIAS_GASTO.join(', ')}`);
  }
  const filas = await listarPublicaciones({ limite, offset: (pagina - 1) * limite, categoria });
  if (filas.length === 0) {
    const total = pagina > 1 ? await contarPublicaciones({ categoria }) : 0;
    return { publicaciones: [], pagina, total_paginas: Math.ceil(total / limite) };
  }

  const ids = filas.map((fila) => fila.id);
  const [conceptos, archivos] = await Promise.all([
    listarConceptosDePublicaciones(ids),
    listarArchivosDePublicaciones(ids),
  ]);

  const publicaciones = filas.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    fecha_gasto: fila.fecha_gasto,
    fecha_publicacion: fila.fecha_publicacion,
    total: Number(fila.total),
    conceptos: [],
    comprobantes_generales: [],
  }));
  const publicacionesPorId = new Map(publicaciones.map((publicacion) => [publicacion.id, publicacion]));
  const conceptosPorId = new Map();
  for (const fila of conceptos) {
    const concepto = {
      id: fila.id,
      nombre: fila.nombre,
      mensaje: fila.mensaje,
      monto: Number(fila.monto),
      categoria: fila.categoria,
      fotos: [],
      comprobantes: [],
    };
    conceptosPorId.set(fila.id, concepto);
    publicacionesPorId.get(fila.publicacion_id)?.conceptos.push(concepto);
  }
  for (const fila of archivos) {
    const archivo = {
      id: fila.id,
      url_archivo: fila.url_archivo,
      mime_type: fila.mime_type,
      nombre_original: fila.nombre_original,
    };
    // concepto_id nulo = comprobante general de la publicación
    if (fila.concepto_id === null) {
      publicacionesPorId.get(fila.publicacion_id)?.comprobantes_generales.push(archivo);
      continue;
    }
    const concepto = conceptosPorId.get(fila.concepto_id);
    if (!concepto) continue;
    (fila.rol === 'foto' ? concepto.fotos : concepto.comprobantes).push(archivo);
  }

  return {
    publicaciones,
    pagina,
    total_paginas: Math.ceil(Number(filas[0].total_registros) / limite),
  };
}
