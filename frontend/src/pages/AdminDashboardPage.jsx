import { useEffect, useState, useMemo } from 'react';
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

// Secciones todavía no implementadas
const ACCESOS_PROXIMAMENTE = [
  { titulo: 'Cuotas y pagos', descripcion: 'Gestión de cargos mensuales y registro de pagos.' },
  { titulo: 'Comunicados', descripcion: 'Publicar avisos y comunicados para los residentes.' },
];

// Datos estáticos para renderizar los edificios
const ALTURAS_FONDO = [40, 65, 50, 80, 60, 90, 55, 75, 45, 68, 52];
const TORRES_FRONTAL = [
  { heightVh: 16, cols: 4 },
  { heightVh: 22, cols: 3 },
  { heightVh: 19, cols: 5 },
  { heightVh: 28, cols: 4 },
  { heightVh: 24, cols: 6 },
  { heightVh: 32, cols: 5 },
  { heightVh: 26, cols: 4 },
  { heightVh: 30, cols: 6 },
  { heightVh: 22, cols: 3 },
  { heightVh: 25, cols: 5 },
  { heightVh: 18, cols: 4 }
];

// Puntos de color para la interpolación según la hora del día (0-24h)
const ANCLAS_COLOR = [
  { h: 0,  top: '#080d18', bot: '#101a2c' },
  { h: 5,  top: '#0c1424', bot: '#2a2438' },
  { h: 7,  top: '#3a3248', bot: '#c97a4a' },
  { h: 9,  top: '#4a6a8a', bot: '#d9b98a' },
  { h: 13, top: '#3f6d92', bot: '#a9c4d6' },
  { h: 17, top: '#3a3450', bot: '#c97a4a' },
  { h: 19, top: '#161226', bot: '#5a3a3a' },
  { h: 21, top: '#0a0e1c', bot: '#161f30' },
  { h: 24, top: '#080d18', bot: '#101a2c' }
];

// Auxiliares para cálculo cromático y proporción de luces
function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixHex(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

function obtenerCieloParaHora(h) {
  for (let i = 0; i < ANCLAS_COLOR.length - 1; i++) {
    const a = ANCLAS_COLOR[i], b = ANCLAS_COLOR[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      return { top: mixHex(a.top, b.top, t), bot: mixHex(a.bot, b.bot, t) };
    }
  }
  return { top: ANCLAS_COLOR[0].top, bot: ANCLAS_COLOR[0].bot };
}

function obtenerProporcionLuces(h) {
  if (h >= 6.5 && h <= 17.5) return 0.02; // Día: ventanales apagados
  let p;
  if (h > 17.5 && h <= 21) {
    p = (h - 17.5) / 3.5;
  } else if (h > 21 || h < 1.5) {
    p = 1.0;
  } else {
    const hNorm = h < 1.5 ? h + 24 : h;
    p = Math.max(0, (6.5 - hNorm) / 5);
  }
  return 0.03 + p * 0.58;
}

export default function AdminDashboardPage() {
  const [horaActual, setHoraActual] = useState(() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  });

  // Mantiene la hora sincronizada en tiempo real cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setHoraActual(d.getHours() + d.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Genera semillas de aleatoriedad para las ventanas una sola vez
  const matrizVentanas = useMemo(() => {
    return TORRES_FRONTAL.map((torre) => {
      const rows = Math.max(3, Math.floor(torre.heightVh / 2.6));
      const totalVentanas = torre.cols * rows;
      return Array.from({ length: totalVentanas }, () => Math.random());
    });
  }, []);

  const coloresCielo = useMemo(() => obtenerCieloParaHora(horaActual), [horaActual]);
  const proporcionLuces = useMemo(() => obtenerProporcionLuces(horaActual), [horaActual]);

  return (
    <div 
      className="admin-dashboard-screen"
      style={{
        '--sky-top': coloresCielo.top,
        '--sky-bot': coloresCielo.bot
      }}
    >
      {/* Fondo dinámico */}
      <div className="fondo-cielo" />
      
      {/* Edificios traseros */}
      <div className="fondo-skyline-back">
        {ALTURAS_FONDO.map((pct, i) => (
          <div key={i} className="bloque-back" style={{ height: `${pct}%` }} />
        ))}
      </div>

      {/* Edificios frontales con ventanas alineadas */}
      <div className="fondo-skyline">
        {TORRES_FRONTAL.map((torre, tIdx) => {
          const rows = Math.max(3, Math.floor(torre.heightVh / 2.6));
          return (
            <div
              key={tIdx}
              className="torre"
              style={{
                height: `${torre.heightVh}vh`,
                gridTemplateColumns: `repeat(${torre.cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`
              }}
            >
              {matrizVentanas[tIdx].map((umbral, vIdx) => (
                <div
                  key={vIdx}
                  className={`ventana ${umbral < proporcionLuces ? 'lit' : ''}`}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="fondo-scrim" />
      <div 
        className="fondo-glow" 
        style={{
          background: `
            radial-gradient(ellipse 900px 600px at 20% 0%, ${coloresCielo.bot}33 0%, transparent 55%),
            radial-gradient(ellipse 700px 600px at 100% 10%, ${coloresCielo.top}33 0%, transparent 50%)
          `
        }}
      />
      <div className="grain" />

      {/* Header fijo de la app */}
      <AdminHeader titulo="Panel de administrador" mostrarVolver={false} />

      {/* Contenido flotante */}
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
