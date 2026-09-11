import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as loginService, logout as logoutService } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Rehidrata la sesión guardada al cargar o recargar la página
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userGuardado = localStorage.getItem('user');

      if (token && userGuardado) {
        try {
          setUser(JSON.parse(userGuardado));
        } catch (error) {
          console.error('Error al parsear el usuario guardado:', error);
          logoutService();
        }
      } else if (token && !userGuardado) {
        // Token sin usuario asociado: estado inconsistente en localStorage, se descarta
        logoutService();
      }
    } catch (error) {
      // localStorage puede no estar disponible en algunos navegadores/modos
      console.error('No se pudo leer la sesión guardada:', error);
    } finally {
      setCargando(false);
    }
  }, []);

  const login = async (correo, password) => {
    const result = await loginService(correo, password);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  };

  const logout = () => {
    logoutService();
    setUser(null);
  };

  const value = { user, login, logout, cargando };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);