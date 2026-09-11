import { Link } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import './AdminDashboardPage.css';

// Accesos ya implementados
const ACCESOS_DISPONIBLES = [
  {
    to: '/admin/residentes/alta',
    titulo: 'Alta de residente',
    descripcion: 'Registrar un nuevo residente y asignarlo a una unidad.',
  },
  {
    to: '/admin/residentes/baja',
    titulo: 'Baja de residente',
    descripcion: 'Desactivar residentes que ya desocuparon su unidad.',
  },
];

// Secciones todavía no implementadas, solo para mostrar hacia dónde crece el panel
const ACCESOS_PROXIMAMENTE = [
  { titulo: 'Cuotas y pagos', descripcion: 'Gestión de cargos mensuales y registro de pagos.' },
  { titulo: 'Incidencias', descripcion: 'Seguimiento de reportes e incidencias del condominio.' },
  { titulo: 'Comunicados', descripcion: 'Publicar avisos y comunicados para los residentes.' },
];

export default function AdminDashboardPage() {
  return (
    <div className="admin-dashboard-screen">
      <AdminHeader titulo="Panel de administrador" mostrarVolver={false} />

      <main className="admin-dashboard-contenido">
        <section>
          <h2 className="admin-dashboard-seccion__titulo">Residentes</h2>
          <div className="admin-dashboard-grid">
            {ACCESOS_DISPONIBLES.map((acceso) => (
              <Link key={acceso.to} to={acceso.to} className="admin-dashboard-tarjeta">
                <h3>{acceso.titulo}</h3>
                <p>{acceso.descripcion}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="admin-dashboard-seccion__titulo">Gestión</h2>
          <div className="admin-dashboard-grid">
            {ACCESOS_PROXIMAMENTE.map((acceso) => (
              <div key={acceso.titulo} className="admin-dashboard-tarjeta admin-dashboard-tarjeta--deshabilitada">
                <h3>{acceso.titulo}</h3>
                <p>{acceso.descripcion}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
