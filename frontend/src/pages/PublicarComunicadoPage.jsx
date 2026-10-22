import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicarComunicado } from '../api/comunicados.api';
import AdminHeader from '../components/AdminHeader';
import './PublicarComunicadoPage.css';

const FORM_VACIO = { titulo: '', contenido: '' };
const MAX_TITULO = 150; // mismo límite que la columna comunicados.titulo

/* ---------- Fondo: cielo dinámico + skyline (mismo que el resto del portal) ---------- */

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

// CU-10: formulario para que el administrador publique un comunicado.
// Si falla el envío, lo capturado se conserva para poder reintentar.
export default function PublicarComunicadoPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [exito, setExito] = useState(false);

  // Hora local del sistema para el cielo y las ventanas encendidas
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

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Limpia el error del campo en cuanto el usuario empieza a corregirlo
    setErrores((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    setExito(false);
  }

  function validar() {
    const nuevosErrores = {};
    if (!form.titulo.trim()) nuevosErrores.titulo = 'El título es obligatorio.';
    if (!form.contenido.trim()) nuevosErrores.contenido = 'El contenido es obligatorio.';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    setErrorEnvio('');
    setExito(false);

    if (!validar()) return;

    setEnviando(true);
    const resultado = await publicarComunicado({
      titulo: form.titulo.trim(),
      contenido: form.contenido.trim(),
    });
    setEnviando(false);

    if (resultado.success) {
      setExito(true);
      setForm(FORM_VACIO);
      setErrores({});
    } else {
      // No limpiamos `form`: el admin conserva lo que escribió y puede reintentar
      setErrorEnvio(resultado.error);
    }
  }

  return (
    <div
      className="publicar-comunicado-page"
      style={{
        '--sky-top': coloresCielo.top,
        '--sky-bot': coloresCielo.bot
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

      <div className="fondo-scrim" aria-hidden="true" />
      <div
        className="fondo-glow"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 900px 600px at 20% 0%, ${coloresCielo.bot}33 0%, transparent 55%),
            radial-gradient(ellipse 700px 600px at 100% 10%, ${coloresCielo.top}33 0%, transparent 50%)
          `
        }}
      />
      <div className="grain" aria-hidden="true" />

      <AdminHeader titulo="Publicar comunicado" />

      <main className="publicar-comunicado-main">
        <div className="publicar-comunicado-card">
          <div className="publicar-comunicado-encabezado">
            <span className="publicar-comunicado-icono" aria-hidden="true">📣</span>
            <div>
              <span className="publicar-comunicado-insignia">Aviso para residentes</span>
              <h1 className="publicar-comunicado-title">Nuevo comunicado</h1>
            </div>
          </div>
          <p className="publicar-comunicado-subtitle">
            Escribe un aviso claro y breve. Se publicará con la fecha de hoy y lo verán todos los
            residentes en su portal.
          </p>

          {exito && (
            <div className="publicar-comunicado-exito" role="status">
              <span className="publicar-comunicado-exito__icono" aria-hidden="true">✓</span>
              <div>
                <strong>Comunicado publicado correctamente.</strong>
                <p>Los residentes ya pueden verlo. Puedes escribir otro si lo necesitas.</p>
              </div>
            </div>
          )}

          {errorEnvio && (
            <div className="publicar-comunicado-error" role="alert">
              {errorEnvio}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="publicar-comunicado-campo">
              <div className="publicar-comunicado-label-fila">
                <label className="publicar-comunicado-label" htmlFor="titulo">
                  Título *
                </label>
                <span className="publicar-comunicado-contador">
                  {form.titulo.length}/{MAX_TITULO}
                </span>
              </div>
              <input
                id="titulo"
                name="titulo"
                type="text"
                value={form.titulo}
                onChange={handleChange}
                maxLength={MAX_TITULO}
                className={`publicar-comunicado-input ${errores.titulo ? 'campo-error' : ''}`}
                placeholder="Ej. Corte de agua el jueves"
                disabled={enviando}
              />
              {errores.titulo && (
                <span className="publicar-comunicado-error-campo">{errores.titulo}</span>
              )}
            </div>

            <div className="publicar-comunicado-campo">
              <div className="publicar-comunicado-label-fila">
                <label className="publicar-comunicado-label" htmlFor="contenido">
                  Contenido *
                </label>
                <span className="publicar-comunicado-contador">
                  {form.contenido.length} caracteres
                </span>
              </div>
              <textarea
                id="contenido"
                name="contenido"
                value={form.contenido}
                onChange={handleChange}
                className={`publicar-comunicado-input publicar-comunicado-textarea ${
                  errores.contenido ? 'campo-error' : ''
                }`}
                placeholder="Escribe el aviso completo: qué pasa, cuándo y qué deben hacer los residentes"
                disabled={enviando}
              />
              {errores.contenido && (
                <span className="publicar-comunicado-error-campo">{errores.contenido}</span>
              )}
            </div>

            <div className="publicar-comunicado-acciones">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="boton-secundario"
                disabled={enviando}
              >
                Cancelar
              </button>
              <button type="submit" className="boton-primario" disabled={enviando}>
                {enviando && <span className="publicar-comunicado-spinner" aria-hidden="true" />}
                {enviando ? 'Publicando…' : 'Publicar comunicado'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
