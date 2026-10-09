import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { obtenerMiEstadoCuenta } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import { etiquetaEstado, formatearFecha, formatearMonto, formatearPeriodo } from '../utils/formatoEstadoCuenta';
import './MiEstadoCuentaPage.css';

const ALTURAS_FONDO = [40, 65, 50, 80, 60, 90, 55, 75, 45, 68, 52];
const TORRES_FRONTAL = [
  { heightVh: 16, cols: 4 }, { heightVh: 22, cols: 3 }, { heightVh: 19, cols: 5 },
  { heightVh: 28, cols: 4 }, { heightVh: 24, cols: 6 }, { heightVh: 32, cols: 5 },
  { heightVh: 26, cols: 4 }, { heightVh: 30, cols: 6 }, { heightVh: 22, cols: 3 },
  { heightVh: 25, cols: 5 }, { heightVh: 18, cols: 4 },
];

// CU-07: el residente consulta sus cargos, pagos y saldo actual.
// La unidad la determina el backend a partir del JWT; aquí no se elige ninguna.
export default function MiEstadoCuentaPage() {
  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const peticionRef = useRef(0); // descarta respuestas viejas (reintentos o desmontaje)

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

  const cargarEstadoCuenta = useCallback(async () => {
    const solicitud = ++peticionRef.current;
    setCargando(true);
    setError('');
    const resultado = await obtenerMiEstadoCuenta();
    if (solicitud !== peticionRef.current) return;
    if (resultado.success) {
      setEstadoCuenta(resultado.estadoCuenta);
    } else {
      setError(resultado.error);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarEstadoCuenta();
    return () => {
      peticionRef.current += 1;
    };
  }, [cargarEstadoCuenta]);

  const sinHistorial = estadoCuenta && estadoCuenta.cargos.length === 0;
  const alCorriente = estadoCuenta && estadoCuenta.saldoActual <= 0;

  return (
    <div
      className="mi-estado-cuenta-page"
      style={{
        '--sky-top': coloresCielo.top,
        '--sky-bot': coloresCielo.bot,
      }}
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

      <AdminHeader
        titulo="Mis cuotas"
        portal="Portal de residentes"
        volverA="/residentes"
        textoVolver="Volver al inicio"
      />

      <main className="mi-estado-cuenta-main">
        <div className="mi-estado-cuenta-card">
          <h1 className="mi-estado-cuenta-title">Mi estado de cuenta</h1>
          <p className="mi-estado-cuenta-subtitle">
            {estadoCuenta?.unidad?.identificador
              ? `Unidad ${estadoCuenta.unidad.identificador} · `
              : ''}
            Consulta tus cargos, los pagos registrados por la administración y tu saldo actual.
          </p>

          {cargando && (
            <p className="mi-estado-cuenta-cargando" role="status">
              Cargando tu estado de cuenta…
            </p>
          )}

          {!cargando && error && (
            <div className="mi-estado-cuenta-error" role="alert">
              <p>{error}</p>
              <button type="button" className="boton-secundario" onClick={cargarEstadoCuenta}>
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && sinHistorial && (
            <div className="mi-estado-cuenta-vacio" role="status">
              <span className="mi-estado-cuenta-vacio__icono" aria-hidden="true">🧾</span>
              <h2>Aún no tienes cargos registrados</h2>
              <p>
                Cuando la administración genere la cuota mensual de tu unidad, aparecerá aquí junto
                con tus pagos y tu saldo.
              </p>
            </div>
          )}

          {!cargando && !error && estadoCuenta && !sinHistorial && (
            <>
              <section
                className={`mi-estado-cuenta-saldo ${alCorriente ? 'mi-estado-cuenta-saldo--al-corriente' : ''}`}
                aria-labelledby="saldo-actual-titulo"
              >
                <div>
                  <h2 id="saldo-actual-titulo" className="mi-estado-cuenta-saldo__etiqueta">
                    Saldo actual
                  </h2>
                  <p className="mi-estado-cuenta-saldo__monto" data-testid="saldo-actual">
                    {formatearMonto(estadoCuenta.saldoActual)}
                  </p>
                  <p className="mi-estado-cuenta-saldo__nota">
                    {alCorriente ? '✓ Estás al corriente con tus pagos.' : 'Pendiente de pago.'}
                  </p>
                </div>
                <dl className="mi-estado-cuenta-resumen">
                  <div>
                    <dt>Total de cargos</dt>
                    <dd>{formatearMonto(estadoCuenta.resumen.total_cargado)}</dd>
                  </div>
                  <div>
                    <dt>Total pagado</dt>
                    <dd>{formatearMonto(estadoCuenta.resumen.total_pagado)}</dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="cargos-titulo">
                <h2 id="cargos-titulo" className="mi-estado-cuenta-seccion">Cargos</h2>
                <div className="mi-estado-cuenta-tabla-contenedor">
                  <table className="mi-estado-cuenta-tabla" aria-labelledby="cargos-titulo">
                    <thead>
                      <tr>
                        <th scope="col">Periodo</th>
                        <th scope="col">Concepto</th>
                        <th scope="col" className="numero">Monto</th>
                        <th scope="col" className="numero">Pagado</th>
                        <th scope="col" className="numero">Por pagar</th>
                        <th scope="col">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estadoCuenta.cargos.map((cargo) => (
                        <tr key={cargo.id}>
                          <td>{formatearPeriodo(cargo.periodo)}</td>
                          <td>{cargo.concepto}</td>
                          <td className="numero">{formatearMonto(cargo.monto)}</td>
                          <td className="numero">{formatearMonto(cargo.total_pagado)}</td>
                          <td className="numero">{formatearMonto(cargo.saldo_pendiente)}</td>
                          <td>
                            <span className={`mi-estado-cuenta-estado mi-estado-cuenta-estado--${cargo.estado}`}>
                              {etiquetaEstado(cargo.estado)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-labelledby="pagos-titulo">
                <h2 id="pagos-titulo" className="mi-estado-cuenta-seccion">Pagos realizados</h2>
                {estadoCuenta.pagos.length === 0 ? (
                  <p className="mi-estado-cuenta-sin-pagos">Aún no tienes pagos registrados.</p>
                ) : (
                  <div className="mi-estado-cuenta-tabla-contenedor">
                    <table className="mi-estado-cuenta-tabla" aria-labelledby="pagos-titulo">
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Cargo</th>
                          <th scope="col" className="numero">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estadoCuenta.pagos.map((pago) => (
                          <tr key={pago.id}>
                            <td>{formatearFecha(pago.fecha_pago)}</td>
                            <td>
                              {pago.concepto} · {formatearPeriodo(pago.periodo)}
                            </td>
                            <td className="numero">{formatearMonto(pago.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
