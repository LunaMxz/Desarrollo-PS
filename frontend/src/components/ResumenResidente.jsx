import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarMisIncidencias, obtenerMiEstadoCuenta } from '../api/client';
import { listarComunicados } from '../api/comunicados.api';
import { formatearFecha, formatearMonto } from '../utils/formatoEstadoCuenta';
import { contarActualizadas, textoAvisoActualizadas } from '../utils/incidenciasRecientes';

function useRecurso(cargar) {
  const [estado, setEstado] = useState({ cargando: true });
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setEstado({ cargando: true });
    Promise.resolve().then(cargar).then((resultado) => {
      if (vigente) setEstado(resultado?.success ? { datos: resultado } : { error: true });
    }).catch(() => { if (vigente) setEstado({ error: true }); });
    return () => { vigente = false; };
  }, [cargar, intento]);
  return { ...estado, reintentar: () => setIntento((n) => n + 1) };
}

function Estado({ recurso, nombre }) {
  if (recurso.cargando) return <p className="rp-muted" role="status">Cargando {nombre}…</p>;
  if (recurso.error) return <div className="rp-error" role="alert">
    <span>No se pudieron cargar {nombre}.</span>
    <button type="button" onClick={recurso.reintentar} aria-label={`Reintentar ${nombre}`}>Reintentar</button>
  </div>;
  return null;
}

const estados = { abierto: 'Abierto', en_proceso: 'En proceso', resuelto: 'Resuelto' };

export default function ResumenResidente() {
  const cuenta = useRecurso(obtenerMiEstadoCuenta);
  const reportes = useRecurso(listarMisIncidencias);
  const avisos = useRecurso(listarComunicados);
  const datos = cuenta.datos?.estadoCuenta;
  const incidencias = reportes.datos?.incidencias;
  const recientes = [...(incidencias ?? [])].sort((a, b) =>
    new Date(b.fecha_actualizacion || b.fecha_creacion) - new Date(a.fecha_actualizacion || a.fecha_creacion)).slice(0, 3);
  const publicaciones = [...(avisos.datos?.comunicados ?? [])].sort((a, b) => new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion)).slice(0, 3);

  const actualizadas = contarActualizadas(incidencias);

  return <>
    {actualizadas > 0 && <div className="rp-aviso" role="status">
      <p>{textoAvisoActualizadas(actualizadas)}</p>
      <Link className="rp-link" to="/residentes/incidencias">Ver mis reportes →</Link>
    </div>}
    <div className="rp-overview">
      <section className="rp-panel rp-account" aria-labelledby="rp-cuenta">
        <div className="rp-heading"><h2 id="rp-cuenta">Mi estado de cuenta</h2><span className="rp-tag">{datos?.unidad?.identificador || 'Mi unidad'}</span></div>
        <Estado recurso={cuenta} nombre="tus cuotas" />
        {datos && <>
          <p className="rp-muted">{datos.saldoActual < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</p>
          <strong className="rp-amount">{formatearMonto(Math.abs(datos.saldoActual))}</strong>
          <span className={`rp-account-status ${datos.saldoActual <= 0 ? 'rp-good' : ''}`}>
            {datos.saldoActual <= 0 ? 'Estás al corriente' : 'Tienes cuotas por cubrir'}
          </span>
          <p className="rp-muted">{datos.cargos.filter((c) => c.estado === 'pendiente' || c.estado === 'parcial').length} cargos pendientes o parciales</p>
        </>}
        <Link className="rp-link" to="/residentes/estado-cuenta">Consultar cargos y pagos →</Link>
      </section>

      <section className="rp-panel" aria-labelledby="rp-reportes">
        <div className="rp-heading"><h2 id="rp-reportes">Mis reportes</h2><span className="rp-tag">Seguimiento</span></div>
        <Estado recurso={reportes} nombre="tus reportes" />
        {incidencias && <>
          <div className="rp-counts">
            <div><strong>{incidencias.filter((i) => i.estado === 'abierto' || i.estado === 'en_proceso').length}</strong><span>Pendientes</span></div>
            <div><strong>{incidencias.filter((i) => i.estado === 'resuelto').length}</strong><span>Resueltos</span></div>
          </div>
          {recientes.length === 0 ? <p className="rp-muted">Aún no has registrado incidencias.</p> : <ul className="rp-reports">
            {recientes.map((i) => <li key={i.id}>
              <div><strong>{i.titulo}</strong><small>{i.responsable || 'Sin responsable asignado'}</small></div>
              <span className={`rp-state rp-state--${i.estado}`}>{estados[i.estado] ?? i.estado}</span>
            </li>)}
          </ul>}
        </>}
        <div className="rp-links">
          <Link className="rp-link" to="/residentes/incidencias">Ver todos mis reportes →</Link>
          <Link className="rp-link" to="/incidencias/reportar">Crear un reporte →</Link>
        </div>
      </section>
    </div>

    <section className="rp-panel" aria-labelledby="rp-avisos">
      <div className="rp-heading"><div><h2 id="rp-avisos">Avisos de tu comunidad</h2><p className="rp-muted">Las publicaciones más recientes de la administración</p></div>
        <Link className="rp-link" to="/residentes/comunicados">Ver avisos y transparencia →</Link></div>
      <Estado recurso={avisos} nombre="los avisos" />
      {avisos.datos && (publicaciones.length ? <div className="rp-notices">
        {publicaciones.map((aviso) => <article key={aviso.id}>
          <time dateTime={aviso.fecha_publicacion}>{formatearFecha(aviso.fecha_publicacion)}</time>
          <h3>{aviso.titulo}</h3><p>{aviso.contenido}</p>
        </article>)}
      </div> : <p className="rp-muted">No hay avisos publicados por el momento.</p>)}
    </section>
  </>;
}
