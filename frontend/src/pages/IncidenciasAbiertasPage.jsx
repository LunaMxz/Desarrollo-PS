import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  listarIncidenciasPendientes,
  asignarResponsable,
  resolverIncidencia,
} from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { RESPONSABLES } from '../constants/responsables';
import './IncidenciasAbiertasPage.css';

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
  if (h >= 6.5 && h <= 17.5) return 0.02;
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

const formatearFecha = (valor) => {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Estados que siguen apareciendo en esta vista (una resuelta sale de la lista)
const ESTADOS_PENDIENTES = ['abierto', 'en_proceso'];

function IncidenciaCard({
  incidencia,
  valor,
  asignando,
  resolviendo,
  bloqueado,
  error,
  onCambio,
  onAsignar,
  onResolver,
}) {
  const opciones =
    incidencia.responsable && !RESPONSABLES.includes(incidencia.responsable)
      ? [incidencia.responsable, ...RESPONSABLES]
      : RESPONSABLES;
  const sinCambios = !valor || valor === incidencia.responsable;
  // Se cuenta el responsable ya guardado, no el que se eligió en el select sin guardar
  const sinResponsable = !incidencia.responsable;
  const idCampo = `responsable-${incidencia.id}`;

  return (
    <li className="incidencia-card">
      <div className="incidencia-card__info">
        <h2 className="incidencia-card__titulo">{incidencia.titulo}</h2>
        {incidencia.descripcion && (
          <p className="incidencia-card__descripcion">{incidencia.descripcion}</p>
        )}
        <p className="incidencia-card__meta">
          📍 {incidencia.ubicacion || 'Sin ubicación'}
          {incidencia.fecha_creacion && ` · ${formatearFecha(incidencia.fecha_creacion)}`}
        </p>
        <p className="incidencia-card__actual">
          {incidencia.responsable
            ? `Responsable actual: ${incidencia.responsable}`
            : 'Sin responsable asignado'}
        </p>
      </div>

      <div className="incidencia-card__accion">
        <label className="incidencia-card__campo" htmlFor={idCampo}>
          <span>Responsable</span>
          <select
            id={idCampo}
            value={valor}
            onChange={(e) => onCambio(incidencia.id, e.target.value)}
            disabled={bloqueado}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {opciones.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="incidencia-card__boton"
          onClick={() => onAsignar(incidencia)}
          disabled={sinCambios || bloqueado}
        >
          {asignando && <span className="incidencias-spinner" aria-hidden="true" />}
          {asignando ? 'Guardando…' : incidencia.responsable ? 'Reasignar' : 'Asignar'}
        </button>

        <button
          type="button"
          className="incidencia-card__boton incidencia-card__boton--resolver"
          onClick={() => onResolver(incidencia)}
          disabled={sinResponsable || bloqueado}
          title={sinResponsable ? 'Asigna un responsable para poder resolver' : undefined}
        >
          {resolviendo && <span className="incidencias-spinner" aria-hidden="true" />}
          {resolviendo ? 'Resolviendo…' : 'Marcar como resuelto'}
        </button>

        {error && (
          <p className="incidencia-card__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

function ModalAsignacion({ confirmacion, onCerrar }) {
  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  const titulo = confirmacion.esResolucion
    ? 'Incidencia resuelta'
    : confirmacion.esReasignacion
      ? 'Responsable reasignado'
      : 'Responsable asignado';

  return (
    <div className="incidencias-modal-overlay" role="presentation" onClick={onCerrar}>
      <div
        className="incidencias-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-asignacion-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="incidencias-modal__icono" aria-hidden="true">✓</div>
        <h2 id="modal-asignacion-titulo" className="incidencias-modal__titulo">
          {titulo}
        </h2>
        <p className="incidencias-modal__texto">
          {confirmacion.esResolucion ? (
            <>«{confirmacion.titulo}» se marcó como resuelta.</>
          ) : (
            <>
              «{confirmacion.titulo}» ahora está a cargo de{' '}
              <strong>{confirmacion.responsable}</strong>.
            </>
          )}
        </p>
        <button type="button" className="incidencias-modal__boton" onClick={onCerrar} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  );
}

export default function IncidenciasAbiertasPage() {
  const [incidencias, setIncidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState('');

  const [seleccion, setSeleccion] = useState({});
  const [asignandoId, setAsignandoId] = useState(null);
  const [resolviendoId, setResolviendoId] = useState(null);
  const [erroresPorId, setErroresPorId] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);

  // Time state based on local system time
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

  const matrizVentanas = useMemo(() => {
    return TORRES_FRONTAL.map((torre) => {
      const rows = Math.max(3, Math.floor(torre.heightVh / 2.6));
      const totalVentanas = torre.cols * rows;
      return Array.from({ length: totalVentanas }, () => Math.random());
    });
  }, []);

  const coloresCielo = useMemo(() => obtenerCieloParaHora(horaActual), [horaActual]);
  const proporcionLuces = useMemo(() => obtenerProporcionLuces(horaActual), [horaActual]);

  const cargarIncidencias = useCallback(async () => {
    setCargando(true);
    setErrorLista('');

    const result = await listarIncidenciasPendientes();
    if (result.success) {
      setIncidencias(result.incidencias);
    } else {
      setErrorLista(result.error);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarIncidencias();
  }, [cargarIncidencias]);

  const cerrarModal = useCallback(() => setConfirmacion(null), []);

  // Mientras se asigna o se resuelve algo, se bloquean los controles de todas las tarjetas
  const ocupado = asignandoId !== null || resolviendoId !== null;

  const quitarSeleccion = (id) =>
    setSeleccion((prev) => {
      const { [id]: _descartado, ...resto } = prev;
      return resto;
    });

  const handleCambio = (id, valor) => {
    setSeleccion((prev) => ({ ...prev, [id]: valor }));
    setErroresPorId((prev) => ({ ...prev, [id]: '' }));
  };

  const handleAsignar = async (incidencia) => {
    const responsable = seleccion[incidencia.id] ?? incidencia.responsable ?? '';
    if (!responsable || responsable === incidencia.responsable || ocupado) return;

    setAsignandoId(incidencia.id);
    setErroresPorId((prev) => ({ ...prev, [incidencia.id]: '' }));

    const result = await asignarResponsable(incidencia.id, responsable);

    if (result.success) {
      const actualizada = { ...incidencia, responsable, ...result.incidencia };

      // El backend pasa la incidencia a "en_proceso" al asignar: sigue en la lista,
      // ahora con responsable, y ya se puede marcar como resuelta.
      setIncidencias((prev) =>
        ESTADOS_PENDIENTES.includes(actualizada.estado)
          ? prev.map((i) => (i.id === incidencia.id ? actualizada : i))
          : prev.filter((i) => i.id !== incidencia.id)
      );
      quitarSeleccion(incidencia.id);
      setConfirmacion({
        titulo: incidencia.titulo,
        responsable,
        esReasignacion: Boolean(incidencia.responsable),
      });
    } else {
      setErroresPorId((prev) => ({ ...prev, [incidencia.id]: result.error }));
    }

    setAsignandoId(null);
  };

  const handleResolver = async (incidencia) => {
    // Sin responsable guardado no se puede resolver
    if (!incidencia.responsable || ocupado) return;

    setResolviendoId(incidencia.id);
    setErroresPorId((prev) => ({ ...prev, [incidencia.id]: '' }));

    const result = await resolverIncidencia(incidencia.id);

    if (result.success) {
      // Ya no está abierta ni en proceso: sale de esta vista
      setIncidencias((prev) => prev.filter((i) => i.id !== incidencia.id));
      quitarSeleccion(incidencia.id);
      setConfirmacion({
        titulo: incidencia.titulo,
        esResolucion: true,
      });
    } else {
      setErroresPorId((prev) => ({ ...prev, [incidencia.id]: result.error }));
    }

    setResolviendoId(null);
  };

  const hayLista = !cargando && !errorLista && incidencias.length > 0;

  return (
    <div
      className="incidencias-screen"
      style={{
        '--sky-top': coloresCielo.top,
        '--sky-bot': coloresCielo.bot
      }}
    >
      {/* Background dynamic sky & skyline */}
      <div className="fondo-cielo" />

      <div className="fondo-skyline-back">
        {ALTURAS_FONDO.map((pct, i) => (
          <div key={i} className="bloque-back" style={{ height: `${pct}%` }} />
        ))}
      </div>

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

      <AdminHeader titulo="Incidencias abiertas" />

      <main className="incidencias-panel">
        <h1 className="incidencias-panel__title">Incidencias abiertas</h1>
        <p className="incidencias-panel__subtitle">
          Asigna o reasigna un responsable a cada reporte pendiente y márcalo como resuelto al
          terminar
        </p>

        {cargando && <p className="incidencias-panel__estado">Cargando incidencias…</p>}

        {!cargando && errorLista && (
          <div className="incidencias-panel__error" role="alert">
            <p>{errorLista}</p>
            <button type="button" className="incidencias-boton-secundario" onClick={cargarIncidencias}>
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorLista && incidencias.length === 0 && (
          <p className="incidencias-panel__estado">No hay incidencias pendientes.</p>
        )}

        {hayLista && (
          <ul className="incidencia-lista">
            {incidencias.map((incidencia) => (
              <IncidenciaCard
                key={incidencia.id}
                incidencia={incidencia}
                valor={seleccion[incidencia.id] ?? incidencia.responsable ?? ''}
                asignando={asignandoId === incidencia.id}
                resolviendo={resolviendoId === incidencia.id}
                bloqueado={ocupado}
                error={erroresPorId[incidencia.id]}
                onCambio={handleCambio}
                onAsignar={handleAsignar}
                onResolver={handleResolver}
              />
            ))}
          </ul>
        )}
      </main>

      {confirmacion && <ModalAsignacion confirmacion={confirmacion} onCerrar={cerrarModal} />}
    </div>
  );
}