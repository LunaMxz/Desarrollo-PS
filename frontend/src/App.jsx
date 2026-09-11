import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

// Vistas de ejemplo
const AdminDashboard = () => <h1>Panel de Administrador</h1>;
const ResidentesPage = () => <h1>Panel de Residentes</h1>;
const BitacoraPage = () => <h1>Bitacora Guardia</h1>;
// Referenciada por ProtectedRoute cuando el rol del usuario no tiene permiso
const Unauthorized = () => <h1>No tienes permiso para ver esta página</h1>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* Ruta de acceso denegado por rol */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Rutas Privadas */}
          <Route element={<ProtectedRoute />}>
            <Route path="/residentes" element={<ResidentesPage />} />
            <Route path="/bitacora" element={<BitacoraPage />} />
          </Route>

          {/* Rutas Privadas restringidas por Rol */}
          <Route element={<ProtectedRoute rolesPermitidos={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}