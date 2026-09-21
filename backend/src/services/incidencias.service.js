import { listar, findById, actualizarResponsable } from '../repositories/incidencias.repository.js';

export async function listarIncidencias({ estado } = {}) {
  return listar({ estado });
}


// ESTE ARCHIVO FUE HECHO POR MICHELLE VENEGAS 
// FRONTEND, BORRALO, SI TE TOCO ESTE CASO DE USO 
//ARCHIVO DE PRUEBA 
//
// CU-08: asigna o reasigna el responsable de una incidencia existente.
export async function asignarResponsable(id, responsable) {
  const incidencia = await findById(id);
  if (!incidencia) {
    throw new Error('Incidencia no encontrada');
  }
  if (!responsable || !responsable.trim()) {
    throw new Error('El responsable es obligatorio');
  }
  return actualizarResponsable(id, responsable.trim());
}