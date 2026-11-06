import {
  buscarPendientePorResidente,
  buscarResidenteActivoDeUnidad,
  insertarRecordatorio,
  marcarVisto,
  obtenerAdeudoDeUnidad,
} from '../repositories/recordatorios.repository.js';

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function leerId(valor, campo) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw errorHttp(400, `El campo "${campo}" debe ser un número entero positivo`);
  }
  return id;
}

const YA_PENDIENTE = 'El residente ya tiene un recordatorio que aún no ha visto';

// CU-14: el administrador manda un recordatorio de pago al residente de una unidad con adeudo
export async function enviarRecordatorio(adminId, unidadIdCrudo) {
  const unidadId = leerId(unidadIdCrudo, 'unidad_id');

  const residente = await buscarResidenteActivoDeUnidad(unidadId);
  if (!residente) throw errorHttp(404, 'La unidad no tiene un residente activo');

  const { adeudo } = await obtenerAdeudoDeUnidad(unidadId);
  if (Number(adeudo) <= 0) throw errorHttp(409, 'La unidad no tiene pagos pendientes');

  if (await buscarPendientePorResidente(residente.id)) throw errorHttp(409, YA_PENDIENTE);

  try {
    const recordatorio = await insertarRecordatorio({
      unidad_id: unidadId,
      residente_id: residente.id,
      admin_id: adminId,
    });
    return {
      ...recordatorio,
      residente_correo: residente.correo,
      unidad_identificador: residente.unidad_identificador,
    };
  } catch (err) {
    // Dos clics casi al mismo tiempo: el índice único deja pasar solo uno
    if (err.code === '23505') throw errorHttp(409, YA_PENDIENTE);
    throw err;
  }
}

// CU-14: recordatorio sin ver del residente, con su adeudo actual (null si no hay)
export async function obtenerRecordatorioPendiente(residenteId) {
  const recordatorio = await buscarPendientePorResidente(residenteId);
  if (!recordatorio) return null;

  const { cargos_pendientes, adeudo } = await obtenerAdeudoDeUnidad(recordatorio.unidad_id);
  if (Number(adeudo) <= 0) {
    // Ya pagó desde que se envió: no tiene caso mostrarlo
    await marcarVisto(recordatorio.id, residenteId);
    return null;
  }
  return {
    id: recordatorio.id,
    fecha_envio: recordatorio.fecha_envio,
    cargos_pendientes,
    adeudo: Number(adeudo),
  };
}

export async function marcarRecordatorioVisto(residenteId, idCrudo) {
  const id = leerId(idCrudo, 'id');
  const recordatorio = await marcarVisto(id, residenteId);
  if (!recordatorio) throw errorHttp(404, 'El recordatorio no existe o ya fue visto');
  return recordatorio;
}
