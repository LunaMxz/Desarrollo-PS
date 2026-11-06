import {
  enviarRecordatorio,
  marcarRecordatorioVisto,
  obtenerRecordatorioPendiente,
} from '../services/recordatorios.service.js';

// CU-14: POST /recordatorios { unidad_id } (admin)
export async function enviarRecordatorioHandler(req, res, next) {
  try {
    const recordatorio = await enviarRecordatorio(req.user.id, req.body?.unidad_id);
    res.status(201).json({ message: 'Recordatorio enviado', recordatorio });
  } catch (err) {
    next(err);
  }
}

// CU-14: GET /recordatorios/pendiente (residente) -> { recordatorio: {...} | null }
export async function recordatorioPendienteHandler(req, res, next) {
  try {
    const recordatorio = await obtenerRecordatorioPendiente(req.user.id);
    res.json({ recordatorio });
  } catch (err) {
    next(err);
  }
}

// CU-14: PATCH /recordatorios/:id/visto (residente)
export async function marcarVistoHandler(req, res, next) {
  try {
    const recordatorio = await marcarRecordatorioVisto(req.user.id, req.params.id);
    res.json({ recordatorio });
  } catch (err) {
    next(err);
  }
}
