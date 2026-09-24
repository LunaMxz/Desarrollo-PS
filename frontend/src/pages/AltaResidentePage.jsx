import { useState, useEffect, useMemo } from 'react';
import { crearResidente } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import './AltaResidentePage.css';

// Estructura skyline para la vista de tarjetas/formularios
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

export default function AltaResidentePage() {
  const [correo, setCorreo] = useState('');
  const [unidad, setUnidad] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null); // { residente, passwordTemporal }

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (cargando) return;

    const correoLimpio = correo.trim();
    const unidadLimpia = unidad.trim();

    if (!correoLimpio || !unidadLimpia) {
      setErrorMsg('Correo y unidad son obligatorios.');
      return;
    }

    setErrorMsg('');
    setResultado(null);
    setCargando(true);

    try {
      const result = await crearResidente(correoLimpio, Number(unidadLimpia));

      if (result.success) {
        setResultado({ residente: result.residente, passwordTemporal: result.passwordTemporal });
        setCorreo('');
        setUnidad('');
      } else {
        setErrorMsg(result.error);
      }
    } catch (err) {
      setErrorMsg('Ocurrió un error inesperado al dar de alta al residente.');
    } finally {
      setCargando(false);
    }
  };

  const handleNuevaAlta = () => {
    setResultado(null);
    setErrorMsg('');
  };

  return (
    <div 
      className="alta-residente-screen"
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
      <AdminHeader titulo="Alta de residente" />

      {/* Panel con tarjeta de formulario */}
      <div className="alta-residente-panel">
        <div className="alta-residente-card">
          <h1 className="alta-residente-card__title">Alta de residente</h1>
          <p className="alta-residente-card__subtitle">
            Cada correo se asigna a una única unidad
          </p>

          {resultado ? (
            <div className="alta-residente-confirm" role="status">
              <div className="alta-residente-confirm__icon" aria-hidden="true">✓</div>
              <p className="alta-residente-confirm__title">Residente creado exitosamente</p>
              <dl className="alta-residente-confirm__details">
                <dt>Correo</dt>
                <dd>{resultado.residente?.correo}</dd>
                <dt>Unidad</dt>
                <dd>{resultado.residente?.unidad_id}</dd>
                <dt>Contraseña temporal</dt>
                <dd className="alta-residente-confirm__password">{resultado.passwordTemporal}</dd>
              </dl>
              <p className="alta-residente-confirm__hint">
                Comparte esta contraseña con el residente; no volverá a mostrarse.
              </p>
              <button
                type="button"
                className="alta-residente-form__submit"
                onClick={handleNuevaAlta}
              >
                Dar de alta otro residente
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="alta-residente-form">
              <label className="alta-residente-form__field" htmlFor="correo">
                <span>Correo electrónico</span>
                <input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="residente@correo.com"
                  required
                  autoComplete="email"
                  disabled={cargando}
                />
              </label>

              <label className="alta-residente-form__field" htmlFor="unidad">
                <span>Unidad</span>
                <input
                  id="unidad"
                  type="number"
                  min="1"
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  placeholder="Número de unidad"
                  required
                  disabled={cargando}
                />
              </label>

              {errorMsg && (
                <p className="alta-residente-form__error" role="alert">
                  {errorMsg}
                </p>
              )}

              <button type="submit" className="alta-residente-form__submit" disabled={cargando}>
                {cargando && <span className="spinner" aria-hidden="true" />}
                {cargando ? 'Guardando…' : 'Dar de alta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
