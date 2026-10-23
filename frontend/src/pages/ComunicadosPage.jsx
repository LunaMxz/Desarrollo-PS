import { useEffect, useMemo, useState } from 'react';
import { listarComunicados } from '../api/comunicados.api';
import AdminHeader from '../components/AdminHeader';
import ListaGastos from '../components/ListaGastos';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import './ComunicadosPage.css';

const ALTURAS_FONDO = [40, 65, 50, 80, 60, 90, 55, 75, 45, 68, 52];
const TORRES_FRONTAL = [
  { heightVh: 16, cols: 4 }, { heightVh: 22, cols: 3 }, { heightVh: 19, cols: 5 },
  { heightVh: 28, cols: 4 }, { heightVh: 24, cols: 6 }, { heightVh: 32, cols: 5 },
  { heightVh: 26, cols: 4 }, { heightVh: 30, cols: 6 }, { heightVh: 22, cols: 3 },
  { heightVh: 25, cols: 5 }, { heightVh: 18, cols: 4 },
];

const LIMITE = 10;
const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });

export default function ComunicadosPage() {
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

  const [pestana, setPestana] = useState('avisos');
  // ListaGastos se monta la primera vez que se abre la pestaña y se conserva después
  const [transparenciaAbierta, setTransparenciaAbierta] = useState(false);
  if (pestana === 'transparencia' && !transparenciaAbierta) setTransparenciaAbierta(true);
  const [comunicados, setComunicados] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    async function cargar() {
      try {
        const resultado = await listarComunicados();
        if (!vigente) return;
        if (resultado.success) {
          setComunicados(resultado.comunicados);
          setPagina(1);
        } else {
          setError(resultado.error);
        }
      } catch {
        if (vigente) setError('No se pudieron cargar los comunicados. Intenta de nuevo.');
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => { vigente = false; };
  }, [intento]);

  // GET /comunicados devuelve todo el arreglo, sin pagina ni total_paginas.
  // Paginamos en el frontend hasta que el contrato admita paginación del servidor.
  // Este estado pertenece solo a Avisos y se conserva al cambiar de pestaña.
  const visibles = comunicados.slice(0, pagina * LIMITE);

  function navegarPestanas(evento) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
    evento.preventDefault();
    const siguiente = evento.key === 'Home' ? 'avisos'
      : evento.key === 'End' ? 'transparencia'
        : pestana === 'avisos' ? 'transparencia' : 'avisos';
    setPestana(siguiente);
    document.getElementById(`tab-${siguiente}`)?.focus();
  }

  return (
    <div className="comunicados-page" style={{ '--sky-top': coloresCielo.top, '--sky-bot': coloresCielo.bot }}>
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


      <AdminHeader titulo="Comunicados" portal="Portal de residentes"
        volverA="/residentes" textoVolver="Volver al inicio" />
      <main className="comunicados-contenido">
        <div className="comunicados-panel">
        <h2 className="comunicados-titulo">Avisos y transparencia</h2>
        <p className="comunicados-subtitulo">Mantente al tanto de las novedades y los gastos de tu comunidad.</p>
        <div className="comunicados-tabs" role="tablist" aria-label="Tipo de publicación"
          onKeyDown={navegarPestanas}>
          {['avisos', 'transparencia'].map((nombre) => (
            <button key={nombre} type="button" role="tab" id={`tab-${nombre}`}
              aria-controls={`panel-${nombre}`} aria-selected={pestana === nombre}
              tabIndex={pestana === nombre ? 0 : -1} onClick={() => setPestana(nombre)}>
              {nombre === 'avisos' ? 'Avisos' : 'Transparencia'}
            </button>
          ))}
        </div>
        <section role="tabpanel" id="panel-avisos" aria-labelledby="tab-avisos"
          hidden={pestana !== 'avisos'} tabIndex={0} aria-busy={cargando}>
          {cargando && <p role="status"><span className="comunicados-spinner" aria-hidden="true" />Cargando comunicados…</p>}
          {!cargando && error && <div role="alert" className="comunicados-error">
            <p>{error}</p>
            <button type="button" onClick={() => setIntento((valor) => valor + 1)}>Reintentar</button>
          </div>}
          {!cargando && !error && comunicados.length === 0 && <p className="comunicados-vacio" role="status">No hay comunicados por el momento</p>}
          {!cargando && !error && visibles.map((comunicado) => {
            const fecha = new Date(comunicado.fecha_publicacion);
            return <article key={comunicado.id} className="comunicado-tarjeta">
              <span className="comunicado-insignia">Aviso</span>
              <h2>{comunicado.titulo}</h2>
              <time dateTime={comunicado.fecha_publicacion}>
                {Number.isNaN(fecha.getTime()) ? 'Fecha no disponible' : formatoFecha.format(fecha)}
              </time>
              <p className="comunicado-texto">{comunicado.contenido}</p>
            </article>;
          })}
          {!cargando && !error && visibles.length < comunicados.length &&
            <button type="button" onClick={() => setPagina((valor) => valor + 1)}>Cargar más</button>}
        </section>
        <section role="tabpanel" id="panel-transparencia" aria-labelledby="tab-transparencia"
          hidden={pestana !== 'transparencia'} tabIndex={0}>
          {/* CU-12 Parte B: maneja su propia carga y paginación, sin compartir el estado de Avisos */}
          {transparenciaAbierta && <ListaGastos />}
        </section>
        </div>
      </main>
    </div>
  );
}
