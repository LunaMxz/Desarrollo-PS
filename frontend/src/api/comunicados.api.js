import apiClient, { mensajeDeError } from './client';

/* ---------- Comunicados (CU-10 / CU-11) ---------- */

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
