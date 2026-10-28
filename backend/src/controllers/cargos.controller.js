import { generarCargosMensuales, obtenerReporteAdeudo, obtenerTotalAdeudo, } from '../services/cargos.service.js';
// CU-06: POST /cargos/generar
export async function generarCargosHandler(req, res, next) {
  try {
    const { monto, concepto } = req.body;
    if (monto === undefined || monto === null || monto === '') {
      const error = new Error('El campo "monto" es obligatorio');
      error.status = 400;
      throw error;
    }
    const { periodo, cargos, omitidas } = await generarCargosMensuales({ monto, concepto });
    if (cargos.length === 0) {
      return res.json({
        message: 'No hay unidades con residente activo; no se generó ningún cargo',
        periodo,
        cargos,
        omitidas,
      });
    }
    res.status(201).json({
      message: omitidas.length > 0
        ? `Cargos generados para el periodo ${periodo}: ${cargos.length}. Unidades omitidas por ya tener su cargo: ${omitidas.length}`
        : `Cargos generados para el periodo ${periodo}: ${cargos.length}`,
      periodo,
      cargos,
      omitidas,
    });
  } catch (err) {
    next(err);
  }
}
export async function reporteAdeudoHandler(req, res, next) {
  try {
    const unidades = await obtenerReporteAdeudo({ minMeses: req.query.min_meses });
    res.json({ unidades });
  } catch (err) {
    next(err);
  }
}
export async function totalAdeudoHandler(req, res, next) {
  try {
    const total = await obtenerTotalAdeudo();
    res.json(total);
  } catch (err) {
    next(err);
  }
}