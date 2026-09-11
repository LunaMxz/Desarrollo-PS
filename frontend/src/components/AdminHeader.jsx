import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminHeader.css';

// Barra superior compartida por las vistas de admin: título de la sección,
// enlace de regreso al dashboard (oculto en el propio dashboard) y cerrar sesión.
export default function AdminHeader({ titulo, mostrarVolver = true }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="admin-header">
      <div className="admin-header__izquierda">
        {mostrarVolver && (
          <Link to="/admin/dashboard" className="admin-header__volver">
            ← Volver al dashboard
          </Link>
        )}
        {titulo && <h1 className="admin-header__titulo">{titulo}</h1>}
      </div>
      <button type="button" className="admin-header__logout" onClick={handleLogout}>
        Cerrar sesión
      </button>
    </header>
  );
}
