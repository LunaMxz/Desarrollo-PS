import { useEffect, useState, useMemo } from 'react';
import { listarResidentes, darDeBajaResidente } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import './BajaResidentePage.css';

// Estructura skyline para la vista de tarjetas y modal
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

// Curva cromática de 24 horas
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
  if (h >= 6.5 && h <= 17.5) return 0.02; // Día: ventanas mayormente apagadas
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

export default function BajaResidentePage() {
  const [residentes, setResidentes] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState('');

  // Residente seleccionado para confirmar la baja (null = modal cerrado)
  const [residenteABaja, setResidenteABaja] = useState(null);
  const [procesandoBaja, setProcesandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState('');
  const [avisoExito, setAvisoExito] = useState('');

  // Lectura de la hora local del dispositivo
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

  const cargarResidentes = async () => {
    setCargandoLista(true);
    setErrorLista('');

    const result = await listarResidentes(true);
    if (result.success) {
      setResidentes(result.residentes);
    } else {
      setErrorLista(result.error);
    }
    setCargandoLista(false);
  };

  useEffect(() => {
    cargarResidentes();
  }, []);

  const abrirConfirmacion = (residente) => {
    setErrorBaja('');
    setResidenteABaja(residente);
  };

  const cerrarConfirmacion = () => {
    if (procesandoBaja) return;
    setResidenteABaja(null);
    setErrorBaja('');
  };

  const confirmarBaja = async () => {
    if (!residenteABaja || procesandoBaja) return;

    setProcesandoBaja(true);
    setErrorBaja('');

    const result = await darDeBajaResidente(residenteABaja.id);

    if (result.success) {
      // Quita al residente de la lista de activos sin volver a golpear la API
      setResidentes((prev) => prev.filter((r) => r.id !== residenteABaja.id));
      setAvisoExito(`${residenteABaja.correo} fue dado de baja correctamente.`);
      setResidenteABaja(null);
    } else {
      setErrorBaja(result.error);
    }

    setProcesandoBaja(false);
  };

  return (
    <div 
      className="baja-residente-screen"
      style={{
        '--sky-top': coloresCielo.top,
        '--sky-bot': coloresCielo.bot
      }}
    >
      {/* Fondo skyline dinámico por hora */}
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

      {/* Header original intacto */}
      <AdminHeader titulo="Baja de residente" />

      {/* Panel principal */}
      <div className="baja-residente-panel">
        <h1 className="baja-residente-panel__title">Residentes activos</h1>
        <p className="baja-residente-panel__subtitle">
          Da de baja a un residente cuando desocupe su unidad
        </p>

        {avisoExito && (
          <p className="baja-residente-panel__exito" role="status">
            {avisoExito}
          </p>
        )}

        {cargandoLista && <p className="baja-residente-panel__estado">Cargando residentes…</p>}

        {!cargandoLista && errorLista && (
          <p className="baja-residente-panel__error" role="alert">
            {errorLista}
          </p>
        )}

        {!cargandoLista && !errorLista && residentes.length === 0 && (
          <p className="baja-residente-panel__estado">No hay residentes activos.</p>
        )}

        {!cargandoLista && !errorLista && residentes.length > 0 && (
          <ul className="ficha-lista">
            {residentes.map((residente) => (
              <li key={residente.id} className="ficha-card">
                <div className="ficha-card__info">
                  <p className="ficha-card__correo">{residente.correo}</p>
                  <p className="ficha-card__unidad">
                    Unidad {residente.unidad_identificador ?? residente.unidad_id}
                  </p>
                </div>
                <button
                  type="button"
                  className="ficha-card__boton-baja"
                  onClick={() => abrirConfirmacion(residente)}
                >
                  Dar de baja
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmación */}
      {residenteABaja && (
        <div className="modal-overlay" role="presentation" onClick={cerrarConfirmacion}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-baja-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="modal-baja-titulo" className="modal-card__titulo">
              ¿Dar de baja a este residente?
            </h2>
            <p className="modal-card__residente">
              {residenteABaja.correo} — Unidad{' '}
              {residenteABaja.unidad_identificador ?? residenteABaja.unidad_id}
            </p>

            <p className="modal-card__advertencia" role="alert">
              ⚠ Verifique manualmente si el residente tiene saldo pendiente antes de confirmar
              la baja. Esta acción desactiva su acceso al sistema.
            </p>

            {errorBaja && (
              <p className="modal-card__error" role="alert">
                {errorBaja}
              </p>
            )}

            <div className="modal-card__acciones">
              <button
                type="button"
                className="modal-card__boton-cancelar"
                onClick={cerrarConfirmacion}
                disabled={procesandoBaja}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-card__boton-confirmar"
                onClick={confirmarBaja}
                disabled={procesandoBaja}
              >
                {procesandoBaja && <span className="spinner" aria-hidden="true" />}
                {procesandoBaja ? 'Procesando…' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}