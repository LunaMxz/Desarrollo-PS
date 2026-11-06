import { useEffect, useId, useState } from 'react';
import { obtenerBalance } from '../api/transparencia.api';
import { formatearMonto } from '../utils/formatoEstadoCuenta';
import { CATEGORIAS } from '../utils/archivosTransparencia';
import './ResumenBalance.css';

const etiquetas = Object.fromEntries(CATEGORIAS.map(({ valor, etiqueta }) => [valor, etiqueta]));
const mostrarSaldo = (monto) => monto < 0
  ? `Déficit de ${formatearMonto(Math.abs(monto))}` : formatearMonto(monto);

export default function ResumenBalance({ mostrarPorCobrar = false }) {
  const id = useId();
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [balance, setBalance] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    async function cargar() {
      try {
        const [anio, mes] = periodo.split('-').map(Number);
        const resultado = await obtenerBalance(anio, mes);
        if (!vigente) return;
        if (resultado.success) setBalance(resultado.balance);
        else setError(resultado.error);
      } catch {
        if (vigente) setError('No se pudo cargar el balance. Intenta de nuevo.');
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => { vigente = false; };
  }, [periodo, intento]);

  return (
    <section className="resumen-balance" aria-labelledby={`${id}-titulo`} aria-busy={cargando}>
      <h2 id={`${id}-titulo`} className="comunicados-titulo">Balance financiero</h2>
      <div className="resumen-balance__selector">
        <label htmlFor={`${id}-mes`}>Mes del balance</label>
        <input id={`${id}-mes`} type="month" value={periodo} min="1000-01" max="9999-12"
          onChange={(evento) => { if (evento.target.validity.valid && evento.target.value) setPeriodo(evento.target.value); }} />
      </div>
      {cargando && <p role="status"><span className="comunicados-spinner" aria-hidden="true" />Cargando balance…</p>}
      {!cargando && error && <div className="comunicados-error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => setIntento((valor) => valor + 1)}>Reintentar</button>
      </div>}
      {!cargando && !error && balance && <>
        <dl className="resumen-balance__tarjetas">
          {[
            ['Ingresos', formatearMonto(balance.ingresos)],
            ['Egresos', formatearMonto(balance.egresos)],
            ['Saldo del mes', mostrarSaldo(balance.saldo_mes)],
            ['Saldo acumulado', mostrarSaldo(balance.saldo_acumulado)],
          ].map(([titulo, monto]) => <div key={titulo}><dt>{titulo}</dt><dd>{monto}</dd></div>)}
        </dl>
        {mostrarPorCobrar && balance.por_cobrar != null && <p>
          Por cobrar actualmente: <strong>{formatearMonto(balance.por_cobrar)}</strong>
          {' · '}Unidades con adeudo: {balance.unidades_con_adeudo}
        </p>}
        {balance.ingresos === 0 && balance.egresos === 0 &&
          <p className="comunicados-vacio" role="status">Sin movimientos este mes</p>}
        {balance.egresos_por_categoria.length > 0 && <div>
          <h3>Egresos por categoría</h3>
          {balance.egresos_por_categoria.map(({ categoria, total }) => (
            <div className="resumen-balance__categoria" key={categoria}>
              <div className="resumen-balance__etiqueta"><span>{etiquetas[categoria] ?? categoria}</span><span>{formatearMonto(total)}</span></div>
              <div className="resumen-balance__pista" aria-hidden="true">
                <div className="resumen-balance__barra" style={{ width: `${balance.egresos > 0 ? Math.min(100, Math.max(0, total / balance.egresos * 100)) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>}
      </>}
    </section>
  );
}
