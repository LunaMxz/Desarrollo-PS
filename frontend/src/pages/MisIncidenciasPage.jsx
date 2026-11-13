import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarMisIncidencias } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import { ETIQUETAS_ESTADO, esActualizada } from '../utils/incidenciasRecientes';
import './ComunicadosPage.css'; // fondo, panel y tarjetas: se reutiliza el estilo de Comunicados
import './MisIncidenciasPage.css';

const ALTURAS_FONDO = [40, 65, 50, 80, 60, 90, 55, 75, 45, 68, 52];
const TORRES_FRONTAL = [
  { heightVh: 16, cols: 4 }, { heightVh: 22, cols: 3 }, { heightVh: 19, cols: 5 },
  { heightVh: 28, cols: 4 }, { heightVh: 24, cols: 6 }, { heightVh: 32, cols: 5 },
  { heightVh: 26, cols: 4 }, { heightVh: 30, cols: 6 }, { heightVh: 22, cols: 3 },
  { heightVh: 25, cols: 5 }, { heightVh: 18, cols: 4 },
];

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'abierto', texto: 'Abiertas' },
  { valor: 'en_proceso', texto: 'En proceso' },
  { valor: 'resuelto', texto: 'Resueltas' },
];
const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

function formatear(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : formatoFecha.format(fecha);
}

function Fecha({ valor }) {
  return <time dateTime={valor}>{formatear(valor)}</time>;
}

// Solo se muestra "Última actualización" si hubo algún cambio después de reportarla
function tuvoCambios(incidencia) {
  return Date.parse(incidencia.fecha_actualizacion) > Date.parse(incidencia.fecha_creacion);
}

export default function MisIncidenciasPage() {
  const [horaActual, setHoraActual] = useState(() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setHoraActual(d.getHours() + d.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const matrizVentanas = useMemo(
    () =>
      TORRES_FRONTAL.map((torre) => {
        const rows = Math.max(3, Math.floor(torre.heightVh / 2.6));
        return Array.from({ length: torre.cols * rows }, () => Math.random());
      }),
    []
  );

  const coloresCielo = useMemo(() => obtenerCieloParaHora(horaActual), [horaActual]);
  const proporcionLuces = useMemo(() => obtenerProporcionLuces(horaActual), [horaActual]);

  const [incidencias, setIncidencias] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    listarMisIncidencias()
      .then((resultado) => {
        if (!vigente) return;
        if (resultado.success) setIncidencias(resultado.incidencias);
        else setError(resultado.error);
      })
      .catch(() => {
        if (vigente) setError('No se pudieron cargar tus reportes. Intenta de nuevo.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => { vigente = false; };
  }, [intento]);

  // GET /incidencias/mias devuelve todas; el filtro por estado se aplica aquí
  const conteos = useMemo(() => {
    const total = { todas: incidencias.length, abierto: 0, en_proceso: 0, resuelto: 0 };
    incidencias.forEach((incidencia) => {
      if (incidencia.estado in total) total[incidencia.estado] += 1;
    });
    return total;
  }, [incidencias]);

  const visibles = filtro === 'todas'
    ? incidencias
    : incidencias.filter((incidencia) => incidencia.estado === filtro);

  return (
    <div
      className="comunicados-page mis-incidencias-page"
      style={{ '--sky-top': coloresCielo.top, '--sky-bot': coloresCielo.bot }}
    >
      {/* Fondo: cielo dinámico y skyline */}
      <div className="fondo-cielo" aria-hidden="true" />

      <div className="fondo-skyline-back" aria-hidden="true">
        {ALTURAS_FONDO.map((pct, i) => (
          <div key={i} className="bloque-back" style={{ height: `${pct}%` }} />
        ))}
      </div>

      <div className="fondo-skyline" aria-hidden="true">
        {TORRES_FRONTAL.map((torre, tIdx) => {
          const rows = Math.max(3, Math.floor(torre.heightVh / 2.6));
          return (
            <div
              key={tIdx}
              className="torre"
              style={{
                height: `${torre.heightVh}vh`,
                gridTemplateColumns: `repeat(${torre.cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {matrizVentanas[tIdx].map((umbral, vIdx) => (
                <div key={vIdx} className={`ventana ${umbral < proporcionLuces ? 'lit' : ''}`} />
              ))}
            </div>
          );
        })}
      </div>

      <div className="fondo-scrim" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <AdminHeader titulo="Mis reportes" portal="Portal de residentes"
        volverA="/residentes" textoVolver="Volver al inicio" />

      <main className="comunicados-contenido">
        <div className="comunicados-panel">
          <h2 className="comunicados-titulo">Seguimiento de tus incidencias</h2>
          <p className="comunicados-subtitulo">
            Consulta en qué va cada reporte, quién lo atiende y cuándo se resolvió.
          </p>

          {cargando && (
            <p role="status">
              <span className="comunicados-spinner" aria-hidden="true" />Cargando tus reportes…
            </p>
          )}

          {!cargando && error && (
            <div role="alert" className="comunicados-error">
              <p>{error}</p>
              <button type="button" onClick={() => setIntento((valor) => valor + 1)}>Reintentar</button>
            </div>
          )}

          {!cargando && !error && incidencias.length === 0 && (
            <div className="comunicados-vacio" role="status">
              <p>No has reportado incidencias</p>
              <Link to="/incidencias/reportar" className="mis-incidencias-enlace">
                Reportar una incidencia
              </Link>
            </div>
          )}

          {!cargando && !error && incidencias.length > 0 && (
            <>
              <div className="mis-incidencias-filtros" role="group" aria-label="Filtrar por estado">
                {FILTROS.map(({ valor, texto }) => (
                  <button key={valor} type="button" aria-pressed={filtro === valor}
                    onClick={() => setFiltro(valor)}>
                    {texto} <span>({conteos[valor]})</span>
                  </button>
                ))}
              </div>

              {visibles.length === 0 && (
                <p className="comunicados-vacio" role="status">
                  No tienes reportes con este estado.
                </p>
              )}

              {visibles.map((incidencia) => (
                <article key={incidencia.id} className="comunicado-tarjeta"
                  aria-labelledby={`incidencia-${incidencia.id}`}>
                  <div className="mis-incidencias-insignias">
                    <span className={`comunicado-insignia mis-incidencias-estado mis-incidencias-estado--${incidencia.estado}`}>
                      {ETIQUETAS_ESTADO[incidencia.estado] ?? incidencia.estado}
                    </span>
                    {esActualizada(incidencia) && (
                      <span className="comunicado-insignia mis-incidencias-actualizada">Actualizada</span>
                    )}
                  </div>
                  <h3 id={`incidencia-${incidencia.id}`}>{incidencia.titulo}</h3>
                  {incidencia.ubicacion && (
                    <p className="mis-incidencias-ubicacion">{incidencia.ubicacion}</p>
                  )}
                  <p className="comunicado-texto">{incidencia.descripcion}</p>
                  <dl className="mis-incidencias-datos">
                    <div>
                      <dt>Responsable</dt>
                      <dd>{incidencia.responsable || 'Sin responsable todavía'}</dd>
                    </div>
                    <div>
                      <dt>Reportada</dt>
                      <dd><Fecha valor={incidencia.fecha_creacion} /></dd>
                    </div>
                    {tuvoCambios(incidencia) && (
                      <div>
                        <dt>Última actualización</dt>
                        <dd><Fecha valor={incidencia.fecha_actualizacion} /></dd>
                      </div>
                    )}
                    {incidencia.estado === 'resuelto' && incidencia.fecha_resolucion && (
                      <div>
                        <dt>Resuelta el</dt>
                        <dd><Fecha valor={incidencia.fecha_resolucion} /></dd>
                      </div>
                    )}
                  </dl>
                </article>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
