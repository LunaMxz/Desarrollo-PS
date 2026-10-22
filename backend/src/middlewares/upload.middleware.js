import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';

// CU-12: fotos y comprobantes de Transparencia.
// La ruta es relativa a donde corre el servidor, igual que express.static('uploads') en app.js
const DIRECTORIO_TRANSPARENCIA = path.join('uploads', 'transparencia');
const MAX_TAMANO_MB = 5;
const MAX_ARCHIVOS = 20;

const TIPOS_FOTO = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const TIPOS_COMPROBANTE = { ...TIPOS_FOTO, '.pdf': 'application/pdf' };

fs.mkdirSync(DIRECTORIO_TRANSPARENCIA, { recursive: true });

const storage = multer.diskStorage({
  destination: DIRECTORIO_TRANSPARENCIA,
  // Nunca se usa el nombre original en disco: evita colisiones y rutas manipuladas
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// fotos_N -> foto del concepto N; comprobantes_N -> comprobante del concepto N;
// comprobantes_generales -> comprobante que cubre varios conceptos
function tiposPermitidos(fieldname) {
  if (/^fotos_\d+$/.test(fieldname)) return TIPOS_FOTO;
  if (/^comprobantes_(\d+|generales)$/.test(fieldname)) return TIPOS_COMPROBANTE;
  return null;
}

function fileFilter(req, file, cb) {
  const tipos = tiposPermitidos(file.fieldname);
  if (!tipos) {
    const error = new Error(
      `El campo de archivo "${file.fieldname}" no es válido. Usa fotos_N, comprobantes_N o comprobantes_generales`
    );
    error.status = 400;
    return cb(error);
  }
  // Se revisa la extensión y el tipo MIME: ninguno de los dos basta por sí solo
  const extension = path.extname(file.originalname).toLowerCase();
  if (!tipos[extension] || !Object.values(tipos).includes(file.mimetype)) {
    const error = new Error(
      tipos === TIPOS_FOTO
        ? `El archivo "${file.originalname}" no es válido: las fotos solo pueden ser JPG o PNG`
        : `El archivo "${file.originalname}" no es válido: los comprobantes solo pueden ser PDF, JPG o PNG`
    );
    error.status = 400;
    return cb(error);
  }
  cb(null, true);
}

const subirArchivos = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_TAMANO_MB * 1024 * 1024, files: MAX_ARCHIVOS },
  defParamCharset: 'utf8', // conserva acentos en el nombre original (ej. "factura jardín.pdf")
}).any();

const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: (err) => `El archivo "${err.filename}" excede el tamaño máximo de ${MAX_TAMANO_MB} MB`,
  LIMIT_FILE_COUNT: () => `Solo se permiten hasta ${MAX_ARCHIVOS} archivos por publicación`,
};

// Si multer falla (archivo inválido o muy pesado) él mismo borra lo que ya había guardado.
// Si todo sale bien, deja en req.archivos los archivos agrupados por campo: { fotos_0: [...], ... }
export function uploadTransparencia(req, res, next) {
  subirArchivos(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        err.status = 400;
        err.message = MENSAJES_MULTER[err.code]?.(err) || 'No se pudieron procesar los archivos enviados';
      }
      return next(err);
    }
    req.archivos = {};
    for (const file of req.files ?? []) {
      if (!req.archivos[file.fieldname]) req.archivos[file.fieldname] = [];
      req.archivos[file.fieldname].push(file);
    }
    next();
  });
}

// Multer NO borra los archivos si el error ocurre después (validación o BD): se borran aquí
export async function eliminarArchivos(files = []) {
  await Promise.allSettled(files.map((file) => fs.promises.unlink(file.path)));
}
