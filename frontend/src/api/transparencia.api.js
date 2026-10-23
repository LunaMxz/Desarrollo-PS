import apiClient from './client';

// Traduce un error de axios a un mensaje legible (prioriza el { error } del backend).
function mensajeDeError(err) {
  if (err.code === 'ECONNABORTED') {
    return 'La subida tardó demasiado. Revisa tu conexión e intenta de nuevo; tus datos siguen aquí.';
  }
  if (err.code === 'ERR_NETWORK' || !err.response) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }
  const { status, data } = err.response;
  if (data?.error) return data.error;
  if (status === 401 || status === 403) return 'No tienes permiso para publicar gastos.';
  if (status === 413) return 'Los archivos son demasiado pesados. Máximo 5 MB por archivo.';
  if (status >= 500) return 'El servidor tuvo un problema. Intenta más tarde.';
  return 'Ocurrió un error inesperado. Intenta más tarde.';
}

// CU-12 (Parte A): publica un gasto con sus conceptos, fotos y comprobantes.
// No se fija Content-Type: axios lo genera con el boundary correcto al recibir FormData.
// onProgress recibe un entero de 0 a 100.
// Devuelve { success, publicacion, mensaje, error }.
export async function publicarGasto(formData, onProgress) {
  try {
    const { data } = await apiClient.post('/transparencia', formData, {
      timeout: 60000,
      onUploadProgress: (evento) => {
        if (onProgress && evento.total) {
          onProgress(Math.round((evento.loaded * 100) / evento.total));
        }
      },
    });
    return {
      success: true,
      publicacion: data?.publicacion ?? data ?? null,
      mensaje: data?.message || 'Gasto publicado correctamente.',
    };
  } catch (err) {
    return { success: false, error: mensajeDeError(err) };
  }
}

// (Alondra: agrega aquí abajo tus funciones de lectura.)