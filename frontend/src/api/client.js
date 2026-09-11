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
