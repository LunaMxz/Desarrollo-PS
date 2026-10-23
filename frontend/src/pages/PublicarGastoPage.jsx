import { useEffect, useMemo, useRef, useState } from 'react';
import { publicarGasto } from '../api/transparencia.api';
import AdminHeader from '../components/AdminHeader';
import ConceptoCard, { ListaArchivos } from '../components/ConceptoCard';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import {
  MONTO_MAXIMO,
  TIPOS_ARCHIVO,
  formatoMoneda,
  mismoArchivo,
  separarArchivos,
  validarArchivo,
} from '../utils/archivosTransparencia';
import './AdminDashboardPage.css';
import './GenerarCargosPage.css';
import './PublicarGastoPage.css';

const ALTURAS_FONDO = [40, 65, 50, 80, 60, 90, 55, 75, 45, 68, 52];
const TORRES_FRONTAL = [
  { heightVh: 16, cols: 4 }, { heightVh: 22, cols: 3 }, { heightVh: 19, cols: 5 },
  { heightVh: 28, cols: 4 }, { heightVh: 24, cols: 6 }, { heightVh: 32, cols: 5 },
  { heightVh: 26, cols: 4 }, { heightVh: 30, cols: 6 }, { heightVh: 22, cols: 3 },
  { heightVh: 25, cols: 5 }, { heightVh: 18, cols: 4 },
];

let contadorConceptos = 0;
const conceptoVacio = () => ({
  id: ++contadorConceptos, // clave local, no se envía al backend
  nombre: '',
  mensaje: '',
  monto: '',
  categoria: 'otros',
  fotos: [],
  comprobantes: [],
});

// Fecha de hoy en hora local (YYYY-MM-DD)
function hoyLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const aCentavos = (texto) => Math.round(Number(texto) * 100) || 0;

// CU-12 (Parte A): el administrador publica un gasto con varios conceptos.
export default function PublicarGastoPage() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaGasto, setFechaGasto] = useState(hoyLocal);
  const [conceptos, setConceptos] = useState(() => [conceptoVacio()]);
  const [generales, setGenerales] = useState([]);
  const [avisoGenerales, setAvisoGenerales] = useState('');
  const [errores, setErrores] = useState({ titulo: '', conceptos: {} });
  const [aviso, setAviso] = useState(null); // { tipo: 'exito' | 'error', texto }
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(0);
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

  // Total en vivo (en centavos para evitar errores de punto flotante)
  const totalCentavos = conceptos.reduce((suma, c) => suma + aCentavos(c.monto), 0);

  const cambiarConcepto = (id, cambios) => {
    setConceptos((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
    setErrores((prev) => ({ ...prev, conceptos: { ...prev.conceptos, [id]: {} } }));
    setAviso(null);
  };

  const agregarConcepto = () => setConceptos((prev) => [...prev, conceptoVacio()]);

  const quitarConcepto = (id) =>
    setConceptos((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));

  const agregarGenerales = (e) => {
    const { validos, errores: invalidos } = separarArchivos(Array.from(e.target.files), 'comprobante');
    const nuevos = validos.filter((f) => !generales.some((existente) => mismoArchivo(existente, f)));
    if (nuevos.length > 0) setGenerales((prev) => [...prev, ...nuevos]);
    setAvisoGenerales(invalidos.join(' '));
    e.target.value = '';
  };

  // Valida todo antes de enviar. Devuelve true si no hay errores.
  const validar = () => {
    const nuevos = { titulo: '', conceptos: {} };
    let valido = true;

    if (!titulo.trim()) {
      nuevos.titulo = 'Escribe un título para el gasto.';
      valido = false;
    }

    conceptos.forEach((c) => {
      const e = {};
      if (!c.nombre.trim()) e.nombre = 'Escribe el nombre del concepto.';
      const monto = Number(c.monto);
      if (!c.monto || !Number.isFinite(monto) || monto <= 0) e.monto = 'El monto debe ser mayor a $0.';
      else if (monto > MONTO_MAXIMO) e.monto = 'El monto es demasiado grande.';
      if (Object.keys(e).length > 0) {
        nuevos.conceptos[c.id] = e;
        valido = false;
      }
    });

    // Revalida archivos por si algo cambió (extensión y peso)
    const archivosInvalidos = [
      ...conceptos.flatMap((c) => [
        ...c.fotos.map((f) => validarArchivo(f, 'foto')),
        ...c.comprobantes.map((f) => validarArchivo(f, 'comprobante')),
      ]),
      ...generales.map((f) => validarArchivo(f, 'comprobante')),
    ].filter(Boolean);

    const totalArchivos =
      conceptos.reduce((s, c) => s + c.fotos.length + c.comprobantes.length, 0) + generales.length;

    setErrores(nuevos);
    if (totalArchivos > 20) {
      setAviso({ tipo: 'error', texto: 'Máximo 20 archivos por publicación.' });
      return false;
    }
    if (archivosInvalidos.length > 0) {
      setAviso({ tipo: 'error', texto: archivosInvalidos[0] });
      return false;
    }
    if (!valido) setAviso({ tipo: 'error', texto: 'Revisa los campos marcados antes de publicar.' });
    return valido;
  };

  // Arma el FormData según el contrato del backend
  const construirFormData = () => {
    const formData = new FormData();
    formData.append('titulo', titulo.trim());
    formData.append('descripcion', descripcion.trim());
    formData.append('fecha_gasto', fechaGasto);
    // Los archivos NO van en el JSON: solo nombre, mensaje, monto y categoría
    formData.append(
      'conceptos',
      JSON.stringify(
        conceptos.map((c) => ({
          nombre: c.nombre.trim(),
          mensaje: c.mensaje.trim(),
          monto: Number(c.monto),
          categoria: c.categoria,
        }))
      )
    );
    conceptos.forEach((c, i) => {
      c.fotos.forEach((foto) => formData.append(`fotos_${i}`, foto));
      c.comprobantes.forEach((archivo) => formData.append(`comprobantes_${i}`, archivo));
    });
    generales.forEach((archivo) => formData.append('comprobantes_generales', archivo));
    return formData;
  };

  const limpiarFormulario = () => {
    setTitulo('');
    setDescripcion('');
    setFechaGasto(hoyLocal());
    setConceptos([conceptoVacio()]);
    setGenerales([]);
    setAvisoGenerales('');
    setErrores({ titulo: '', conceptos: {} });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enviandoRef.current) return;
    setAviso(null);
    if (!validar()) return;

    const formData = construirFormData();
    enviandoRef.current = true;
    setEnviando(true);
    setProgreso(0);

    const resultado = await publicarGasto(formData, setProgreso);

    if (resultado.success) {
      limpiarFormulario();
      setAviso({ tipo: 'exito', texto: resultado.mensaje });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Si falla se conserva todo lo capturado para reintentar
      setAviso({ tipo: 'error', texto: resultado.error });
    }

    setEnviando(false);
    enviandoRef.current = false;
  };

  return (
    <div className="generar-cargos-screen publicar-gasto-screen" style={{ '--sky-top': cielo.top, '--sky-bot': cielo.bot }}>
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

      <AdminHeader titulo="Transparencia" />

      <main className="pg-panel">
        <form className="pg-card" onSubmit={handleSubmit} noValidate>
          <h1 className="pg-card__titulo">Publicar gasto</h1>
          <p className="pg-card__subtitulo">
            Registra en qué se gastó el dinero del condominio. Los residentes verán cada concepto con sus fotos y comprobantes.
          </p>

          {aviso && (
            <p className={`pg-aviso pg-aviso--${aviso.tipo}`} role={aviso.tipo === 'exito' ? 'status' : 'alert'}>
              {aviso.tipo === 'exito' ? '✓ ' : ''}
              {aviso.texto}
            </p>
          )}

          <fieldset className="pg-datos" disabled={enviando}>
            <label className="pg-campo pg-campo--ancho" htmlFor="gasto-titulo">
              <span>Título *</span>
              <input
                id="gasto-titulo"
                type="text"
                maxLength={150}
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  setErrores((prev) => ({ ...prev, titulo: '' }));
                }}
                placeholder="Ej. Mejoras del jardín - Octubre"
                aria-invalid={Boolean(errores.titulo)}
              />
              {errores.titulo && <span className="pg-error" role="alert">{errores.titulo}</span>}
            </label>

            <label className="pg-campo" htmlFor="gasto-fecha">
              <span>Fecha del gasto</span>
              <input
                id="gasto-fecha"
                type="date"
                max={hoyLocal()}
                value={fechaGasto}
                onChange={(e) => setFechaGasto(e.target.value)}
              />
            </label>

            <label className="pg-campo pg-campo--ancho" htmlFor="gasto-descripcion">
              <span>Descripción</span>
              <textarea
                id="gasto-descripcion"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Opcional: contexto general del gasto"
              />
            </label>
          </fieldset>

          <h2 className="pg-seccion">Conceptos</h2>
          {conceptos.map((concepto, i) => (
            <ConceptoCard
              key={concepto.id}
              concepto={concepto}
              numero={i + 1}
              puedeQuitar={conceptos.length > 1}
              bloqueado={enviando}
              errores={errores.conceptos[concepto.id]}
              onCambio={cambiarConcepto}
              onQuitar={quitarConcepto}
            />
          ))}

          <button type="button" className="pg-agregar" onClick={agregarConcepto} disabled={enviando}>
            + Agregar otro concepto
          </button>

          <fieldset className="pg-generales" disabled={enviando}>
            <legend className="pg-seccion">Comprobantes generales</legend>
            <p className="pg-ayuda">
              Para un ticket o factura que cubre varios conceptos a la vez. {TIPOS_ARCHIVO.comprobante.etiqueta} · máximo 5 MB por archivo.
            </p>
            <label className="pg-subir">
              <input
                type="file"
                multiple
                accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                onChange={agregarGenerales}
              />
              <span>+ Agregar comprobantes generales</span>
            </label>
            {avisoGenerales && <p className="pg-error" role="alert">{avisoGenerales}</p>}
            <ListaArchivos
              archivos={generales}
              onQuitar={(i) => setGenerales((prev) => prev.filter((_, idx) => idx !== i))}
              deshabilitado={enviando}
            />
          </fieldset>

          {enviando && (
            <div className="pg-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso} aria-label="Progreso de la subida">
              <div className="pg-progreso__barra" style={{ width: `${progreso}%` }} />
            </div>
          )}

          <div className="pg-pie">
            <div className="pg-total" aria-live="polite">
              <span>Total del gasto</span>
              <strong data-testid="total-gasto">{formatoMoneda.format(totalCentavos / 100)}</strong>
            </div>
            <button type="submit" className="pg-publicar" disabled={enviando}>
              {enviando && <span className="generar-cargos-spinner" aria-hidden="true" />}
              {enviando ? `Publicando… ${progreso}%` : 'Publicar gasto'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}