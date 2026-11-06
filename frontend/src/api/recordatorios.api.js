import apiClient, { mensajeDeError } from './client';

/* ---------- Recordatorios de pago (CU-14) ---------- */

// Admin: POST /recordatorios { unidad_id } -> 201 { message, recordatorio }
// 404 si la unidad no tiene residente activo; 409 si ya tiene uno sin ver o ya no debe.
// Devuelve { success, recordatorio, error }.
export async function enviarRecordatorioPago(unidadId) {
  try {
    const { data } = await apiClient.post('/recordatorios', { unidad_id: unidadId });
    return { success: true, recordatorio: data.recordatorio };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, { noAutorizado: 'No tienes permiso para enviar recordatorios.' }),
    };
  }
}

// Residente: GET /recordatorios/pendiente -> { recordatorio: { id, fecha_envio, cargos_pendientes, adeudo } | null }
// Devuelve { success, recordatorio, error }.
export async function obtenerRecordatorioPendiente() {
  try {
    const { data } = await apiClient.get('/recordatorios/pendiente');
    return { success: true, recordatorio: data?.recordatorio ?? null };
  } catch (err) {
    return { success: false, error: mensajeDeError(err) };
  }
}

// Residente: PATCH /recordatorios/:id/visto. Devuelve { success, error }.
export async function marcarRecordatorioVisto(id) {
  try {
    await apiClient.patch(`/recordatorios/${id}/visto`);
    return { success: true };
  } catch (err) {
    return { success: false, error: mensajeDeError(err) };
  }
}
