import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ResidenteHomePage.css';

const SECCIONES_PROXIMAMENTE = [
  { titulo: 'Mis cuotas', descripcion: 'Consulta tus cargos y el historial de pagos.' },
  { titulo: 'Reportar incidencia', descripcion: 'Levanta reportes sobre tu unidad o áreas comunes.' },
  { titulo: 'Comunicados', descripcion: 'Avisos y comunicados publicados por la administración.' },
];

export default function ResidenteHomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="residente-home-screen">
      <header className="residente-home-header">
        <div>
          <p className="residente-home-header__eyebrow">Portal de residentes</p>
          <h1 className="residente-home-header__titulo">Hola{user?.correo ? `, ${user.correo}` : ''}</h1>
        </div>
        <button type="button" className="residente-home-header__logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <main className="residente-home-contenido">
        <div className="residente-home-grid">
          {SECCIONES_PROXIMAMENTE.map((seccion) => (
            <div key={seccion.titulo} className="residente-home-tarjeta">
              <span className="residente-home-tarjeta__badge">Próximamente…</span>
              <h3>{seccion.titulo}</h3>
              <p>{seccion.descripcion}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
