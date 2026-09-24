import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 8000, // evita que las peticiones queden esperando indefinidamente si el backend no responde
});

// Adjunta el JWT guardado a cada request, si existe
apiClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    // localStorage puede no estar disponible (modo privado, política del navegador, etc.)
    console.error('No se pudo leer el token de localStorage:', error);
  }
  return config;
});

// Traduce un error de axios a un mensaje legible para el usuario.
// - noAutorizado: mensaje por defecto para 401/403
// - noEncontrado: mensaje por defecto para 404
// Si el backend envía { error }, ese texto tiene prioridad.
function mensajeDeError(err, { noAutorizado, noEncontrado } = {}) {
  if (err.code === 'ECONNABORTED') {
    return 'El servidor tardó demasiado en responder. Intente más tarde.';
  }
  if (err.code === 'ERR_NETWORK' || !err.response) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }

  const { status, data } = err.response;
  const mensajeApi = data?.error;

  if ((status === 401 || status === 403) && noAutorizado) return mensajeApi || noAutorizado;
  if (status === 404 && noEncontrado) return mensajeApi || noEncontrado;
  if (status >= 500) return mensajeApi || 'El servidor tuvo un problema. Intenta más tarde.';
  return mensajeApi || 'Ocurrió un error inesperado. Intenta más tarde.';
}

/* ---------- Sesión ---------- */

// Inicia sesión contra el backend y persiste el token + usuario en localStorage.
// Devuelve { success, user, error } para que AuthContext lo consuma directamente.
export async function login(correo, password) {
  try {
    const response = await apiClient.post('/auth/login', { correo, password });
    const { token, usuario: user } = response.data;

    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch (storageError) {
      // Si el navegador bloquea localStorage (modo privado, cuota llena, etc.)
      // la sesión no persistirá al recargar, pero el login en curso sigue siendo válido.
      console.error('No se pudo guardar la sesión en localStorage:', storageError);
    }

    return { success: true, user };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, { noAutorizado: 'Correo o contraseña incorrectos.' }),
    };
  }
}

// Limpia la sesión guardada localmente
export function logout() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch (error) {
    console.error('No se pudo limpiar la sesión de localStorage:', error);
  }
}

/* ---------- Residentes (CU-04 / CU-05) ---------- */

// Genera una contraseña temporal segura para asignarle al residente al darlo de alta.
// El admin la comunica al residente fuera del sistema; no hay flujo de invitación por correo.
export function generarPasswordTemporal() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

// Da de alta un residente. El backend exige correo, password y unidad_id;
// la password temporal se genera en el frontend (ver generarPasswordTemporal).
// Devuelve { success, residente, passwordTemporal, error }.
export async function crearResidente(correo, unidadId) {
  const passwordTemporal = generarPasswordTemporal();

  try {
    const response = await apiClient.post('/residentes', {
      correo,
      password: passwordTemporal,
      unidad_id: unidadId,
    });
    return { success: true, residente: response.data.residente, passwordTemporal };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, { noAutorizado: 'No tienes permiso para dar de alta residentes.' }),
    };
  }
}

// Lista los residentes para la ficha/panel de administración.
// Por defecto solo trae activos; soloActivos=false incluye también los dados de baja.
// Devuelve { success, residentes, error }.
export async function listarResidentes(soloActivos = true) {
  try {
    const response = await apiClient.get('/residentes', { params: { soloActivos } });
    return { success: true, residentes: response.data.residentes };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, { noAutorizado: 'No tienes permiso para ver los residentes.' }),
    };
  }
}

// Da de baja (desactiva) a un residente. El backend solo marca activo=false,
// nunca borra el registro. Devuelve { success, residente, aviso, error }.
export async function darDeBajaResidente(id) {
  try {
    const response = await apiClient.patch(`/residentes/${id}/baja`);
    return { success: true, residente: response.data.residente, aviso: response.data.aviso };
  } catch (err) {
    return {
      success: false,
      error: mensajeDeError(err, {
        noAutorizado: 'No tienes permiso para dar de baja residentes.',
        noEncontrado: 'El residente no existe.',
      }),
    };
  }
}

/* ---------- Incidencias (CU-08 / CU-09) ---------- */

const ERRORES_INCIDENCIAS = {
  noAutorizado: 'No tienes permiso para gestionar incidencias.',
  noEncontrado: 'La incidencia no existe.',
};

// Lista las incidencias con estado "abierto". Se vuelve a filtrar en el cliente
// para no depender de que el backend aplique el filtro.
// Devuelve { success, incidencias, error }.
export async function listarIncidenciasAbiertas() {
  try {
    const response = await apiClient.get('/incidencias', { params: { estado: 'abierto' } });
    const incidencias = (response.data.incidencias ?? []).filter((i) => i.estado === 'abierto');
    return { success: true, incidencias };
  } catch (err) {
    return { success: false, error: mensajeDeError(err, ERRORES_INCIDENCIAS) };
  }
}

// Lista las incidencias pendientes: las "abierto" y las "en_proceso" (ya tienen responsable
// pero aún no se resuelven). El backend solo filtra por un estado a la vez, así que se pide
// todo y se filtra en el cliente. Devuelve { success, incidencias, error }.
export async function listarIncidenciasPendientes() {
  try {
    const response = await apiClient.get('/incidencias');
    const incidencias = (response.data.incidencias ?? []).filter(
      (i) => i.estado === 'abierto' || i.estado === 'en_proceso'
    );
    return { success: true, incidencias };
  } catch (err) {
    return { success: false, error: mensajeDeError(err, ERRORES_INCIDENCIAS) };
  }
}

// Asigna o reasigna el responsable de una incidencia (incidencias.responsable es texto).
// Devuelve { success, incidencia, error }.
export async function asignarResponsable(id, responsable) {
  try {
    const response = await apiClient.patch(`/incidencias/${id}/asignar`, { responsable });
    return { success: true, incidencia: response.data.incidencia };
  } catch (err) {
    return { success: false, error: mensajeDeError(err, ERRORES_INCIDENCIAS) };
  }
}

// Marca una incidencia como resuelta (CU-09).
// Devuelve { success, incidencia, error }.
export async function resolverIncidencia(id) {
  try {
    const response = await apiClient.patch(`/incidencias/${id}/resolver`);
    return { success: true, incidencia: response.data.incidencia };
  } catch (err) {
    return { success: false, error: mensajeDeError(err, ERRORES_INCIDENCIAS) };
  }
}

export default apiClient;