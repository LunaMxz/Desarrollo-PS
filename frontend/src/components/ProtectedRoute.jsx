import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Envuelve una ruta para exigir sesion activa (CU-01).
 * Uso: <Route path="/residentes" element={<ProtectedRoute><ResidentesPage /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
