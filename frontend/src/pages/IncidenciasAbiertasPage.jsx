import { useCallback, useEffect, useState } from 'react';
import { listarIncidenciasAbiertas, asignarResponsable } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { RESPONSABLES } from '../constants/responsables';
import './IncidenciasAbiertasPage.css';

const formatearFecha = (valor) => {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

function IncidenciaCard({ incidencia, valor, asignando, bloqueado, error, onCambio, onAsignar }) {
  // Si el responsable guardado no está en el catálogo, se conserva como opción
  const opciones =
    incidencia.responsable && !RESPONSABLES.includes(incidencia.responsable)
      ? [incidencia.responsable, ...RESPONSABLES]
      : RESPONSABLES;
  const sinCambios = !valor || valor === incidencia.responsable;
  const idCampo = `responsable-${incidencia.id}`;

  return (
    <li className="incidencia-card">
      <div className="incidencia-card__info">
        <h2 className="incidencia-card__titulo">{incidencia.titulo}</h2>
        {incidencia.descripcion && (
          <p className="incidencia-card__descripcion">{incidencia.descripcion}</p>
        )}
        <p className="incidencia-card__meta">
          {incidencia.ubicacion || 'Sin ubicación'}
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
  // Cierra con Escape
  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

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
          {confirmacion.esReasignacion ? 'Responsable reasignado' : 'Responsable asignado'}
        </h2>
        <p className="incidencias-modal__texto">
          «{confirmacion.titulo}» ahora está a cargo de <strong>{confirmacion.responsable}</strong>.
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

  const [seleccion, setSeleccion] = useState({}); // { [id]: responsable elegido sin guardar }
  const [asignandoId, setAsignandoId] = useState(null);
  const [erroresPorId, setErroresPorId] = useState({});
  const [confirmacion, setConfirmacion] = useState(null); // null = modal cerrado

  const cargarIncidencias = useCallback(async () => {
    setCargando(true);
    setErrorLista('');

    const result = await listarIncidenciasAbiertas();
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

  const handleCambio = (id, valor) => {
    setSeleccion((prev) => ({ ...prev, [id]: valor }));
    setErroresPorId((prev) => ({ ...prev, [id]: '' }));
  };

  const handleAsignar = async (incidencia) => {
    const responsable = seleccion[incidencia.id] ?? incidencia.responsable ?? '';
    if (!responsable || responsable === incidencia.responsable || asignandoId !== null) return;

    setAsignandoId(incidencia.id);
    setErroresPorId((prev) => ({ ...prev, [incidencia.id]: '' }));

    const result = await asignarResponsable(incidencia.id, responsable);

    if (result.success) {
      const actualizada = { ...incidencia, responsable, ...result.incidencia };

      // Si el backend ya no la considera "abierta", sale de esta vista
      setIncidencias((prev) =>
        actualizada.estado === 'abierto'
          ? prev.map((i) => (i.id === incidencia.id ? actualizada : i))
          : prev.filter((i) => i.id !== incidencia.id)
      );
      setSeleccion((prev) => {
        const { [incidencia.id]: _descartado, ...resto } = prev;
        return resto;
      });
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

  const hayLista = !cargando && !errorLista && incidencias.length > 0;

  return (
    <div className="incidencias-screen">
      <AdminHeader titulo="Incidencias abiertas" />

      <main className="incidencias-panel">
        <h1 className="incidencias-panel__title">Incidencias abiertas</h1>
        <p className="incidencias-panel__subtitle">
          Asigna o reasigna un responsable a cada reporte pendiente
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
          <p className="incidencias-panel__estado">No hay incidencias abiertas.</p>
        )}

        {hayLista && (
          <ul className="incidencia-lista">
            {incidencias.map((incidencia) => (
              <IncidenciaCard
                key={incidencia.id}
                incidencia={incidencia}
                valor={seleccion[incidencia.id] ?? incidencia.responsable ?? ''}
                asignando={asignandoId === incidencia.id}
                bloqueado={asignandoId !== null}
                error={erroresPorId[incidencia.id]}
                onCambio={handleCambio}
                onAsignar={handleAsignar}
              />
            ))}
          </ul>
        )}
      </main>

      {confirmacion && <ModalAsignacion confirmacion={confirmacion} onCerrar={cerrarModal} />}
    </div>
  );
}