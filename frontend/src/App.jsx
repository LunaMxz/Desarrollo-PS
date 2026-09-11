import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AltaResidentePage from './pages/AltaResidentePage';
import BajaResidentePage from './pages/BajaResidentePage';
import ResidenteHomePage from './pages/ResidenteHomePage';
import ProtectedRoute from './components/ProtectedRoute';

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
            <Route path="/residentes" element={<ResidenteHomePage />} />
          </Route>

          {/* Rutas Privadas restringidas por Rol */}
          <Route element={<ProtectedRoute rolesPermitidos={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/residentes/alta" element={<AltaResidentePage />} />
            <Route path="/admin/residentes/baja" element={<BajaResidentePage />} />
          </Route>

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
