import { actualizarResponsableYEstado } from '../repositories/incidencias.repository.js';
const ESTADOS_VALIDOS = ['abierto', 'en_proceso', 'resuelto'];
export async function actualizarIncidencia(id, { responsable, estado }) {
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    throw new Error('Estado inválido. Debe ser "abierto", "en_proceso" o "resuelto"');
  }
  let incidencia;
  try {
    incidencia = await actualizarResponsableYEstado(id, { responsable, estado });
  } catch (err) {
    if (err.code === '22P02') {
      throw new Error('Estado inválido. Debe ser "abierto", "en_proceso" o "resuelto"');
    }
    throw err;
  }
  if (!incidencia) {
    throw new Error('Incidencia no encontrada');
  }
  return incidencia;
}