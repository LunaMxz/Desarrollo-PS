import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ rolesPermitidos }) {
  const { user, cargando } = useAuth();

  // 1. Muestra un estado de carga mientras verifica el token en localStorage
  if (cargando) {
    return <div>Cargando sesión...</div>;
  }

  // 2. Si no hay usuario autenticado, redirige al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Validación opcional por Rol
  if (rolesPermitidos && !rolesPermitidos.includes(user.rol)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. Si pasa los controles, renderiza la ruta o sus hijas
  return <Outlet />;
}