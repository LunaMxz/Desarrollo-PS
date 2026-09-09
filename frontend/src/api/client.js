import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Adjunta el JWT guardado a cada request, si existe
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Inicia sesión contra el backend y persiste el token + usuario en localStorage.
// Devuelve { success, user, error } para que AuthContext lo consuma directamente.
export async function login(correo, password) {
  try {
    const response = await apiClient.post('/auth/login', { correo, password });
    const { token, usuario: user } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    return { success: true, user };
  } catch (err) {
    let error;
    if (err.code === 'ECONNABORTED') {
      error = 'El servidor no responde. Intenta de nuevo en unos momentos.';
    } else if (err.response?.status === 401) {
      error = 'Correo o contraseña incorrectos.';
    } else {
      error = 'Ocurrió un error inesperado. Intenta más tarde.';
    }
    return { success: false, error };
  }
}

// Limpia la sesión guardada localmente
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export default apiClient;
