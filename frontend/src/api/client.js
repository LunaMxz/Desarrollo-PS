import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 8000, // evita que el login quede esperando indefinidamente si el backend no responde
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
    let error;
    if (err.code === 'ECONNABORTED') {
      error = 'El servidor tardó demasiado en responder. Intente más tarde.';
    } else if (err.code === 'ERR_NETWORK' || !err.response) {
      error = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
    } else if (err.response?.status === 401) {
      error = err.response?.data?.error || 'Correo o contraseña incorrectos.';
    } else if (err.response?.status >= 500) {
      error = err.response?.data?.error || 'El servidor tuvo un problema. Intenta más tarde.';
    } else {
      error = err.response?.data?.error || 'Ocurrió un error inesperado. Intenta más tarde.';
    }
    return { success: false, error };
  }
}

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
    let error;
    if (err.code === 'ECONNABORTED') {
      error = 'El servidor tardó demasiado en responder. Intente más tarde.';
    } else if (err.code === 'ERR_NETWORK' || !err.response) {
      error = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
    } else if (err.response?.status === 401 || err.response?.status === 403) {
      error = err.response?.data?.error || 'No tienes permiso para dar de alta residentes.';
    } else if (err.response?.status >= 500) {
      error = err.response?.data?.error || 'El servidor tuvo un problema. Intenta más tarde.';
    } else {
      error = err.response?.data?.error || 'Ocurrió un error inesperado. Intenta más tarde.';
    }
    return { success: false, error };
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
    let error;
    if (err.code === 'ECONNABORTED') {
      error = 'El servidor tardó demasiado en responder. Intente más tarde.';
    } else if (err.code === 'ERR_NETWORK' || !err.response) {
      error = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
    } else if (err.response?.status === 401 || err.response?.status === 403) {
      error = err.response?.data?.error || 'No tienes permiso para ver los residentes.';
    } else if (err.response?.status >= 500) {
      error = err.response?.data?.error || 'El servidor tuvo un problema. Intenta más tarde.';
    } else {
      error = err.response?.data?.error || 'Ocurrió un error inesperado. Intenta más tarde.';
    }
    return { success: false, error };
  }
}

// Da de baja (desactiva) a un residente. El backend solo marca activo=false,
// nunca borra el registro. Devuelve { success, residente, aviso, error }.
export async function darDeBajaResidente(id) {
  try {
    const response = await apiClient.patch(`/residentes/${id}/baja`);
    return { success: true, residente: response.data.residente, aviso: response.data.aviso };
  } catch (err) {
    let error;
    if (err.code === 'ECONNABORTED') {
      error = 'El servidor tardó demasiado en responder. Intente más tarde.';
    } else if (err.code === 'ERR_NETWORK' || !err.response) {
      error = 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
    } else if (err.response?.status === 404) {
      error = err.response?.data?.error || 'El residente no existe.';
    } else if (err.response?.status === 401 || err.response?.status === 403) {
      error = err.response?.data?.error || 'No tienes permiso para dar de baja residentes.';
    } else if (err.response?.status >= 500) {
      error = err.response?.data?.error || 'El servidor tuvo un problema. Intenta más tarde.';
    } else {
      error = err.response?.data?.error || 'Ocurrió un error inesperado. Intenta más tarde.';
    }
    return { success: false, error };
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

export default apiClient;
