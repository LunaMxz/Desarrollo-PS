import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminHeader.css';

// Encabezado compartido con el diseño del portal de residentes.
export default function AdminHeader({
  titulo,
  mostrarVolver = true,
  portal = 'Portal de administración',
  volverA = '/admin/dashboard',
  textoVolver = 'Volver al dashboard',
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="admin-header">
      <div className="admin-header__izquierda">
        <p className="admin-header__eyebrow">{portal}</p>
        {titulo && <h1 className="admin-header__titulo">{titulo}</h1>}
      </div>
      <div className="admin-header__acciones">
        {mostrarVolver && (
          <Link to={volverA} className="admin-header__volver">
            ← {textoVolver}
          </Link>
        )}
        <button type="button" className="admin-header__logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
