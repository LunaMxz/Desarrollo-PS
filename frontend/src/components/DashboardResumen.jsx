import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarIncidenciasPendientes, obtenerMorosidad } from '../api/client';
import { listarGastos, obtenerBalance } from '../api/transparencia.api';
import { listarComunicados } from '../api/comunicados.api';
import { formatearMonto, formatearFecha } from '../utils/formatoEstadoCuenta';

function useDatos(cargar) {
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

const cargarBalance = () => {
  const hoy = new Date();
  return obtenerBalance(hoy.getFullYear(), hoy.getMonth() + 1);
};
const cargarGastos = () => listarGastos(1, 4);
const saldo = (valor) => valor < 0 ? `Déficit de ${formatearMonto(Math.abs(valor))}` : formatearMonto(valor);

function Estado({ recurso, nombre }) {
  if (recurso.cargando) return <p className="dash-muted" role="status">Cargando {nombre}…</p>;
  if (recurso.error) return <div className="dash-error" role="alert">
    <span>No se pudo cargar {nombre}.</span>
    <button type="button" onClick={recurso.reintentar} aria-label={`Reintentar ${nombre}`}>Reintentar</button>
  </div>;
  return null;
}

function Publicaciones({ recurso, tipo, campo }) {
  const registros = recurso.datos?.[campo] ?? [];
  const recientes = [...registros].sort((a, b) => new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion)).slice(0, 4);
  return <div>
    <h3 className="dash-list-title">{tipo}</h3>
    <Estado recurso={recurso} nombre={tipo.toLowerCase()} />
    {recurso.datos && (recientes.length ? <ul className="dash-publicaciones">
      {recientes.map((item) => <li key={item.id}>
        <span className="dash-publicacion-marca" aria-hidden="true">{tipo === 'Comunicados' ? '↗' : '$'}</span>
        <div><strong>{item.titulo}</strong><time dateTime={item.fecha_publicacion}>{formatearFecha(item.fecha_publicacion)}</time></div>
        {tipo === 'Gastos' && <span>{formatearMonto(item.total)}</span>}
      </li>)}
    </ul> : <p className="dash-muted">No hay {tipo.toLowerCase()} publicados.</p>)}
  </div>;
}

export default function DashboardResumen() {
  const balance = useDatos(cargarBalance);
  const morosidad = useDatos(obtenerMorosidad);
  const incidencias = useDatos(listarIncidenciasPendientes);
  const comunicados = useDatos(listarComunicados);
  const gastos = useDatos(cargarGastos);
  const b = balance.datos?.balance;
  const unidades = morosidad.datos?.unidades;
  const pendientes = incidencias.datos?.incidencias;
  const sinResponsable = pendientes?.filter((i) => !i.responsable?.trim()).length;
  const maximo = b ? Math.max(b.ingresos, b.egresos, 1) : 1;
  const totalAdeudo = unidades?.reduce((suma, u) => suma + Math.round(Number(u.adeudo) * 100), 0) / 100;

  return <>
    <section className="dash-indicators" aria-label="Resumen del mes">
      {[
        ['Ingresos', b ? formatearMonto(b.ingresos) : '—', 'Cobros del mes', 'green'],
        ['Egresos', b ? formatearMonto(b.egresos) : '—', 'Gastos del mes', 'gold'],
        ['Saldo del mes', b ? saldo(b.saldo_mes) : '—', 'Ingresos menos egresos', 'blue'],
        ['Unidades con adeudo', unidades ? unidades.length : '—', 'Situación actual', 'rose'],
      ].map(([titulo, valor, nota, tono], i) => <div className={`dash-ind dash-tone-${tono}`} key={titulo}>
        <p>{titulo}</p><strong>{valor}</strong>
        <small>{(i === 3 ? morosidad : balance).cargando ? 'Cargando…' : (i === 3 ? morosidad : balance).error ? 'No disponible' : nota}</small>
      </div>)}
    </section>

    <div className="dash-main-row">
      <section className="dash-panel" aria-labelledby="dash-atencion">
        <div className="dash-panel-heading"><h2 id="dash-atencion">Requiere atención</h2><span className="dash-tag">Pendientes</span></div>
        <Estado recurso={incidencias} nombre="incidencias" />
        {pendientes && <div className="dash-attention-item">
          <span className="dash-attention-number">{pendientes.length}</span>
          <div><h3>Incidencias pendientes</h3><p>{sinResponsable} sin responsable asignado</p>
            <Link to="/admin/incidencias">Gestionar incidencias →</Link></div>
        </div>}
        <Estado recurso={morosidad} nombre="morosidad" />
        {unidades && <div className="dash-attention-item">
          <span className="dash-attention-number">{unidades.length}</span>
          <div><h3>Unidades con pagos pendientes</h3><p>{formatearMonto(totalAdeudo)} por cobrar actualmente</p>
            <Link to="/admin/morosidad">Ver morosidad →</Link></div>
        </div>}
        {pendientes?.length === 0 && unidades?.length === 0 && <p className="dash-success">Sin incidencias pendientes ni unidades con adeudo.</p>}
      </section>

      <section className="dash-panel" aria-labelledby="dash-balance">
        <div className="dash-panel-heading"><h2 id="dash-balance">Balance del mes</h2><span className="dash-tag">MXN</span></div>
        <Estado recurso={balance} nombre="balance" />
        {b && <>
          <p className="dash-muted">Ingresos y egresos del mes actual</p>
          {[['Ingresos', b.ingresos, 'green'], ['Egresos', b.egresos, 'gold']].map(([nombre, valor, tono]) =>
            <div className={`dash-comparison dash-tone-${tono}`} key={nombre}>
              <div><span>{nombre}</span><strong>{formatearMonto(valor)}</strong></div>
              <div className="dash-track" aria-hidden="true"><div style={{ width: `${Math.max(0, valor) / maximo * 100}%` }} /></div>
            </div>)}
          {b.ingresos === 0 && b.egresos === 0 && <p className="dash-muted">Sin movimientos este mes</p>}
          <div className="dash-accumulated"><span>Saldo acumulado</span><strong>{saldo(b.saldo_acumulado)}</strong></div>
        </>}
        <Link className="dash-text-link" to="/admin/transparencia/balance">Ver balance completo →</Link>
      </section>
    </div>

    <section className="dash-panel" aria-labelledby="dash-publicaciones">
      <div className="dash-panel-heading"><div><h2 id="dash-publicaciones">Últimas publicaciones</h2><p className="dash-muted">Lo más reciente de tu comunidad</p></div>
        <Link className="dash-text-link" to="/admin/comunicados">Ver historial →</Link></div>
      <div className="dash-publicaciones-grid">
        <Publicaciones recurso={comunicados} tipo="Comunicados" campo="comunicados" />
        <Publicaciones recurso={gastos} tipo="Gastos" campo="publicaciones" />
      </div>
    </section>
  </>;
}
