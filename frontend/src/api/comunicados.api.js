import apiClient, { mensajeDeError } from './client';
import { comunicadosPrueba } from '../mocks/comunicados';

/* ---------- Comunicados (CU-10 / CU-11) ---------- */

// Modo temporal explícito: VITE_COMUNICADOS_MOCK=true en desarrollo.
// No sustituimos errores de la API con datos ficticios.
export async function listarComunicados() {
  if (import.meta.env.DEV && import.meta.env.VITE_COMUNICADOS_MOCK === 'true') {
    return { success: true, comunicados: comunicadosPrueba };
  }
  try {
    const { data } = await apiClient.get('/comunicados');
    if (!Array.isArray(data?.comunicados)) {
      return { success: false, error: 'El servidor devolvió un listado de comunicados inválido.' };
    }
    return { success: true, comunicados: data.comunicados };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, { noAutorizado: 'No tienes permiso para consultar comunicados.' }),
    };
  }
}

// POST /comunicados -> 201 { message, comunicado }
// Solo el admin puede publicar; el backend toma el autor del JWT.
// Devuelve { success, comunicado, error }.
export async function publicarComunicado(datos) {
  try {
    const { data } = await apiClient.post('/comunicados', datos);
    return { success: true, comunicado: data?.comunicado };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, { noAutorizado: 'No tienes permiso para publicar comunicados.' }),
    };
  }
}
