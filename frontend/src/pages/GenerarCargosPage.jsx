import { useEffect, useMemo, useRef, useState } from 'react';
import { generarCargos } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import './GenerarCargosPage.css';

const ALTURAS_FONDO = [40, 65, 50, 80, 60, 90, 55, 75, 45, 68, 52];
const TORRES_FRONTAL = [
  { heightVh: 16, cols: 4 }, { heightVh: 22, cols: 3 }, { heightVh: 19, cols: 5 },
  { heightVh: 28, cols: 4 }, { heightVh: 24, cols: 6 }, { heightVh: 32, cols: 5 },
  { heightVh: 26, cols: 4 }, { heightVh: 30, cols: 6 }, { heightVh: 22, cols: 3 },
  { heightVh: 25, cols: 5 }, { heightVh: 18, cols: 4 },
];

const MONTO_MAXIMO = 1000000;

const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

// '2026-10' -> 'octubre 2026'
function formatearPeriodo(periodo) {
  const [anio, mes] = String(periodo).split('-').map(Number);
  if (!anio || !mes) return String(periodo);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

// Deja solo dígitos y un punto decimal con máximo 2 decimales
function limpiarMonto(texto) {
  const soloNumeros = texto.replace(/[^\d.]/g, '');
  const [entero, ...resto] = soloNumeros.split('.');
  if (resto.length === 0) return entero;
  return `${entero}.${resto.join('').slice(0, 2)}`;
}

// Devuelve el mensaje de error o '' si el monto es válido
function validarMonto(texto) {
  if (!texto) return 'Ingresa el monto de la cuota mensual.';
  const monto = Number(texto);
  if (!Number.isFinite(monto)) return 'El monto no es válido.';
  if (monto <= 0) return 'El monto debe ser mayor a $0.';
  if (monto > MONTO_MAXIMO) return `El monto no puede exceder ${formatoMoneda.format(MONTO_MAXIMO)}.`;
  return '';
}

export default function GenerarCargosPage() {
  const [monto, setMonto] = useState('');
  const [errorCampo, setErrorCampo] = useState('');
  const [generando, setGenerando] = useState(false);
  // aviso: { tipo: 'exito' | 'duplicado' | 'error', texto }
  const [aviso, setAviso] = useState(null);
  // resumen de la última generación exitosa: { periodo, generados, monto, omitidas }
  const [resumen, setResumen] = useState(null);
  const enviandoRef = useRef(false); // bloquea doble clic antes del re-render

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
  const cielo = useMemo(() => obtenerCieloParaHora(horaActual), [horaActual]);
  const proporcionLuces = useMemo(() => obtenerProporcionLuces(horaActual), [horaActual]);

  const handleMontoChange = (e) => {
    setMonto(limpiarMonto(e.target.value));
    setErrorCampo('');
    setAviso(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enviandoRef.current) return;

    const error = validarMonto(monto);
    if (error) {
      setErrorCampo(error);
      return;
    }

    enviandoRef.current = true;
    setGenerando(true);
    setAviso(null);
    setResumen(null);

    const montoEnviado = Number(monto);
    const resultado = await generarCargos(montoEnviado);

    if (resultado.success && resultado.sinUnidades) {
      setAviso({ tipo: 'duplicado', texto: resultado.mensaje });
    } else if (resultado.success) {
      setAviso({ tipo: 'exito', texto: resultado.mensaje });
      setResumen({
        periodo: resultado.periodo,
        generados: resultado.cargos.length,
        monto: montoEnviado,
        omitidas: resultado.omitidas,
      });
      setMonto('');
    } else {
      setAviso({ tipo: resultado.duplicado ? 'duplicado' : 'error', texto: resultado.error });
    }

    setGenerando(false);
    enviandoRef.current = false;
  };

  return (
    <div className="generar-cargos-screen" style={{ '--sky-top': cielo.top, '--sky-bot': cielo.bot }}>
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
      <div className="fondo-scrim" />
      <div className="grain" />

      <AdminHeader titulo="Cuotas y pagos" />

      <main className="generar-cargos-panel">
        <div className="generar-cargos-card">
          <h1 className="generar-cargos-card__title">Generar cargos del mes</h1>
          <p className="generar-cargos-card__subtitle">
            Se genera un cargo por unidad con la cuota que indiques. Solo puede generarse una vez por mes.
          </p>

          {aviso && (
            <p
              className={`generar-cargos-aviso generar-cargos-aviso--${aviso.tipo}`}
              role={aviso.tipo === 'exito' ? 'status' : 'alert'}
            >
              {aviso.tipo === 'exito' ? '✓ ' : aviso.tipo === 'duplicado' ? 'ⓘ ' : ''}
              {aviso.texto}
            </p>
          )}

          {resumen && (
            <dl className="generar-cargos-resumen">
              <div><dt>Periodo</dt><dd>{formatearPeriodo(resumen.periodo)}</dd></div>
              <div><dt>Cuota por unidad</dt><dd>{formatoMoneda.format(resumen.monto)}</dd></div>
              <div><dt>Cargos generados</dt><dd>{resumen.generados}</dd></div>
              {resumen.omitidas.length > 0 && (
                <div>
                  <dt>Omitidas (ya tenían cargo)</dt>
                  <dd>{resumen.omitidas.map((u) => u.identificador).join(', ')}</dd>
                </div>
              )}
            </dl>
          )}

          <form onSubmit={handleSubmit} noValidate className="generar-cargos-form">
            <label className="generar-cargos-form__field" htmlFor="monto">
              <span>Monto de la cuota mensual</span>
              <div className={`generar-cargos-form__input ${errorCampo ? 'generar-cargos-form__input--error' : ''}`}>
                <span className="generar-cargos-form__signo" aria-hidden="true">$</span>
                <input
                  id="monto"
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={handleMontoChange}
                  placeholder="0.00"
                  autoComplete="off"
                  disabled={generando}
                  aria-invalid={Boolean(errorCampo)}
                  aria-describedby={errorCampo ? 'monto-error' : undefined}
                />
              </div>
              {errorCampo && (
                <span id="monto-error" className="generar-cargos-form__error" role="alert">
                  {errorCampo}
                </span>
              )}
            </label>

            <button type="submit" className="generar-cargos-form__submit" disabled={generando}>
              {generando && <span className="generar-cargos-spinner" aria-hidden="true" />}
              {generando ? 'Generando…' : 'Generar cargos del mes'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}