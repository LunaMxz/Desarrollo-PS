import { publicarTransparencia, listarTransparencia, obtenerBalance } from '../services/transparencia.service.js';
import { eliminarArchivos } from '../middlewares/upload.middleware.js';

const LIMITE_DEFAULT = 10;
const LIMITE_MAXIMO = 50;

// CU-12: POST /transparencia (multipart/form-data)
// Campos de texto: titulo, descripcion, fecha_gasto y conceptos (JSON con el arreglo de conceptos).
// Archivos: fotos_N, comprobantes_N (N = índice del concepto) y comprobantes_generales.
export async function publicarTransparenciaHandler(req, res, next) {
  try {
    const { titulo, descripcion, fecha_gasto, conceptos } = req.body;
    if (conceptos === undefined || conceptos === '') {
      const error = new Error('El campo "conceptos" es obligatorio');
      error.status = 400;
      throw error;
    }
    let conceptosParseados;
    try {
      conceptosParseados = JSON.parse(conceptos);
    } catch {
      const error = new Error('El campo "conceptos" debe ser un JSON válido');
      error.status = 400;
      throw error;
    }
    const publicacion = await publicarTransparencia({
      titulo,
      descripcion,
      fechaGasto: fecha_gasto,
      conceptos: conceptosParseados,
      archivos: req.archivos,
      autorId: req.user.id,
    });
    res.status(201).json({
      message: 'Publicación de transparencia creada exitosamente',
      publicacion,
    });
  } catch (err) {
    // Si falla la validación o la BD, los archivos que multer ya guardó quedarían huérfanos
    await eliminarArchivos(req.files);
    next(err);
  }
}

function leerEnteroPositivo(valor, porDefecto, nombre) {
  if (valor === undefined || valor === '') return porDefecto;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1) {
    const error = new Error(`El parámetro "${nombre}" debe ser un entero mayor a 0`);
    error.status = 400;
    throw error;
  }
  return numero;
}

// CU-12: GET /transparencia?pagina=1&limite=10&categoria=mejoras
export async function listarTransparenciaHandler(req, res, next) {
  try {
    const pagina = leerEnteroPositivo(req.query.pagina, 1, 'pagina');
    const limite = Math.min(leerEnteroPositivo(req.query.limite, LIMITE_DEFAULT, 'limite'), LIMITE_MAXIMO);
    const resultado = await listarTransparencia({
      pagina,
      limite,
      categoria: req.query.categoria || undefined,
    });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// CU-13: GET /transparencia/balance?anio=2026&mes=10
// Si no vienen anio o mes se usa el mes actual. La validación de los valores está en el service.
export async function obtenerBalanceHandler(req, res, next) {
  try {
    const hoy = new Date();
    const balance = await obtenerBalance({
      anio: req.query.anio || hoy.getFullYear(),
      mes: req.query.mes || hoy.getMonth() + 1,
      esAdmin: req.user.rol === 'admin',
    });
    res.json(balance);
  } catch (err) {
    next(err);
  }
}
