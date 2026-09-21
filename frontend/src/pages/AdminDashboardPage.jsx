import { Link } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import './AdminDashboardPage.css';

// Accesos ya implementados, agrupados por sección
const SECCIONES_DISPONIBLES = [
  {
    titulo: 'Residentes',
    accesos: [
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
    ],
  },
  {
    titulo: 'Incidencias',
    accesos: [
      {
        to: '/admin/incidencias',
        titulo: 'Incidencias abiertas',
        descripcion: 'Asignar o reasignar responsables a los reportes pendientes.',
      },
    ],
  },
];

// Secciones todavía no implementadas, solo para mostrar hacia dónde crece el panel
const ACCESOS_PROXIMAMENTE = [
  { titulo: 'Cuotas y pagos', descripcion: 'Gestión de cargos mensuales y registro de pagos.' },
  { titulo: 'Comunicados', descripcion: 'Publicar avisos y comunicados para los residentes.' },
];

export default function AdminDashboardPage() {
  return (
    <div className="admin-dashboard-screen">
      <AdminHeader titulo="Panel de administrador" mostrarVolver={false} />

      <main className="admin-dashboard-contenido">
        {SECCIONES_DISPONIBLES.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="admin-dashboard-seccion__titulo">{seccion.titulo}</h2>
            <div className="admin-dashboard-grid">
              {seccion.accesos.map((acceso) => (
                <Link key={acceso.to} to={acceso.to} className="admin-dashboard-tarjeta">
                  <h3>{acceso.titulo}</h3>
                  <p>{acceso.descripcion}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="admin-dashboard-seccion__titulo">Próximamente</h2>
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
