import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listarGastos } from '../api/transparencia.api';
import { CATEGORIAS, formatoMoneda } from '../utils/archivosTransparencia';
import './ListaGastos.css';

const LIMITE = 10;
const API_URL = import.meta.env.VITE_API_URL ?? '';
const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' });
const ETIQUETA_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.etiqueta]));

// El backend guarda rutas relativas (/uploads/transparencia/<uuid>.<ext>)
function urlArchivo(url) {
  return `${API_URL}${url}`;
}

// fecha_gasto es un DATE: llega como "2026-10-22" o "2026-10-22T06:00:00.000Z".
// Se toma solo la parte AAAA-MM-DD para no mostrar el día anterior por la zona horaria.
function formatearFechaGasto(valor) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
  if (!coincidencia) return 'Fecha no disponible';
  const [, anio, mes, dia] = coincidencia;
  return formatoFecha.format(new Date(Number(anio), Number(mes) - 1, Number(dia)));
}

function esPdf(archivo) {
  return archivo.mime_type === 'application/pdf';
}

function esImagen(archivo) {
  return archivo.mime_type?.startsWith('image/');
}

// Botón para abrir una factura o ticket en otra pestaña (desde ahí se puede descargar)
function BotonComprobante({ archivo, texto = 'Ver factura' }) {
  const tipo = esPdf(archivo) ? 'PDF' : esImagen(archivo) ? 'Imagen' : 'Archivo';
  return (
    <a
      className={`gasto-comprobante gasto-comprobante--${tipo.toLowerCase()}`}
      href={urlArchivo(archivo.url_archivo)}
      target="_blank"
      rel="noopener noreferrer"
      title={archivo.nombre_original}
    >
      <span className="gasto-comprobante__icono" aria-hidden="true">{esPdf(archivo) ? '📄' : '🧾'}</span>
      {texto}
      <span className="gasto-comprobante__tipo">{tipo}</span>
      <span className="sr-only"> ({archivo.nombre_original}, se abre en otra pestaña)</span>
    </a>
  );
}

// Visor de fotos a pantalla completa. Esc cierra; flechas cambian de foto.
function VisorFotos({ fotos, indice, onCambiar, onCerrar }) {
  const botonCerrar = useRef(null);
  const foto = fotos[indice];
  const hayVarias = fotos.length > 1;

  useEffect(() => {
    botonCerrar.current?.focus();
  }, []);

  useEffect(() => {
    function alPresionar(e) {
      if (e.key === 'Escape') onCerrar();
      if (hayVarias && e.key === 'ArrowRight') onCambiar((indice + 1) % fotos.length);
      if (hayVarias && e.key === 'ArrowLeft') onCambiar((indice - 1 + fotos.length) % fotos.length);
    }
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [indice, fotos.length, hayVarias, onCambiar, onCerrar]);

  // Portal a <body>: el panel padre usa backdrop-filter, que atraparía un position: fixed
  return createPortal(
    <div className="gasto-visor" role="dialog" aria-modal="true" aria-label="Foto del gasto" onClick={onCerrar}>
      <div className="gasto-visor__contenido" onClick={(e) => e.stopPropagation()}>
        <img src={urlArchivo(foto.url_archivo)} alt={foto.nombre_original} />
        <div className="gasto-visor__barra">
          {hayVarias && (
            <button type="button" aria-label="Foto anterior"
              onClick={() => onCambiar((indice - 1 + fotos.length) % fotos.length)}>‹</button>
          )}
          <span>{hayVarias ? `${indice + 1} de ${fotos.length}` : foto.nombre_original}</span>
          {hayVarias && (
            <button type="button" aria-label="Foto siguiente"
              onClick={() => onCambiar((indice + 1) % fotos.length)}>›</button>
          )}
          <button type="button" ref={botonCerrar} className="gasto-visor__cerrar" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Concepto({ concepto, onAbrirFoto }) {
  return (
    <li className="gasto-concepto">
      <div className="gasto-concepto__encabezado">
        <div>
          <h4 className="gasto-concepto__nombre">{concepto.nombre}</h4>
          <span className={`gasto-categoria gasto-categoria--${concepto.categoria}`}>
            {ETIQUETA_CATEGORIA[concepto.categoria] ?? concepto.categoria}
          </span>
        </div>
        <span className="gasto-concepto__monto">{formatoMoneda.format(concepto.monto)}</span>
      </div>

      {concepto.mensaje && <p className="gasto-concepto__mensaje">{concepto.mensaje}</p>}

      {concepto.fotos.length > 0 && (
        <ul className="gasto-galeria" aria-label={`Fotos de ${concepto.nombre}`}>
          {concepto.fotos.map((foto, i) => (
            <li key={foto.id}>
              <button type="button" className="gasto-galeria__miniatura" onClick={() => onAbrirFoto(concepto.fotos, i)}
                aria-label={`Ver foto ${i + 1} de ${concepto.nombre} en grande`}>
                <img src={urlArchivo(foto.url_archivo)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {concepto.comprobantes.length > 0 && (
        <div className="gasto-comprobantes">
          {concepto.comprobantes.map((archivo) => (
            <BotonComprobante key={archivo.id} archivo={archivo} />
          ))}
        </div>
      )}
    </li>
  );
}

function TarjetaGasto({ publicacion, onAbrirFoto }) {
  return (
    <article className="gasto-tarjeta">
      <div className="gasto-tarjeta__encabezado">
        <div>
          <span className="gasto-insignia">Reporte de gasto</span>
          <h3 className="gasto-tarjeta__titulo">{publicacion.titulo}</h3>
          <p className="gasto-tarjeta__fecha">Gasto del {formatearFechaGasto(publicacion.fecha_gasto)}</p>
        </div>
        <div className="gasto-total">
          <span className="gasto-total__etiqueta">Total</span>
          <span className="gasto-total__monto">{formatoMoneda.format(publicacion.total)}</span>
        </div>
      </div>

      {publicacion.descripcion && <p className="gasto-tarjeta__descripcion">{publicacion.descripcion}</p>}

      <h4 className="gasto-seccion">Conceptos ({publicacion.conceptos.length})</h4>
      <ul className="gasto-conceptos">
        {publicacion.conceptos.map((concepto) => (
          <Concepto key={concepto.id} concepto={concepto} onAbrirFoto={onAbrirFoto} />
        ))}
      </ul>

      {publicacion.comprobantes_generales.length > 0 && (
        <div className="gasto-generales">
          <h4 className="gasto-seccion">Comprobantes generales</h4>
          <div className="gasto-comprobantes">
            {publicacion.comprobantes_generales.map((archivo) => (
              <BotonComprobante key={archivo.id} archivo={archivo} texto="Ver comprobante" />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

// CU-12 (Parte B): reportes de gasto del condominio para residentes y administradores.
// Sin ruta propia: se muestra en la pestaña "Transparencia" de ComunicadosPage y
// maneja su propia carga y paginación.
export default function ListaGastos() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [visor, setVisor] = useState(null); // { fotos, indice }
  const vigente = useRef(true);

  useEffect(() => {
    vigente.current = true;
    return () => { vigente.current = false; };
  }, []);

  const cargarPagina = useCallback(async (numero) => {
    setCargando(true);
    setError('');
    const resultado = await listarGastos(numero, LIMITE);
    if (!vigente.current) return;
    if (resultado.success) {
      // La página 1 reemplaza (carga inicial o reintento); las siguientes se agregan
      setPublicaciones((previas) => (numero === 1 ? resultado.publicaciones : [...previas, ...resultado.publicaciones]));
      setPagina(numero);
      setTotalPaginas(resultado.totalPaginas);
    } else {
      setError(resultado.error);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarPagina(1);
  }, [cargarPagina]);

  const abrirFoto = useCallback((fotos, indice) => setVisor({ fotos, indice }), []);
  const cambiarFoto = useCallback((indice) => setVisor((v) => ({ ...v, indice })), []);
  const cerrarVisor = useCallback(() => setVisor(null), []);

  const sinDatos = publicaciones.length === 0;
  const hayMas = pagina < totalPaginas;

  return (
    <div className="lista-gastos" aria-busy={cargando}>
      {cargando && sinDatos && (
        <p role="status" className="lista-gastos__estado">
          <span className="lista-gastos__spinner" aria-hidden="true" />Cargando gastos…
        </p>
      )}

      {!cargando && error && sinDatos && (
        <div role="alert" className="lista-gastos__error">
          <p>{error}</p>
          <button type="button" onClick={() => cargarPagina(1)}>Reintentar</button>
        </div>
      )}

      {!cargando && !error && sinDatos && (
        <p className="lista-gastos__vacio" role="status">Aún no hay gastos publicados</p>
      )}

      {publicaciones.map((publicacion) => (
        <TarjetaGasto key={publicacion.id} publicacion={publicacion} onAbrirFoto={abrirFoto} />
      ))}

      {/* Error al cargar más: se conserva lo ya mostrado */}
      {!cargando && error && !sinDatos && (
        <div role="alert" className="lista-gastos__error">
          <p>{error}</p>
          <button type="button" onClick={() => cargarPagina(pagina + 1)}>Reintentar</button>
        </div>
      )}

      {!sinDatos && (hayMas || (cargando && pagina > 0)) && !error && (
        <button type="button" className="lista-gastos__mas" onClick={() => cargarPagina(pagina + 1)} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Cargar más'}
        </button>
      )}

      {visor && (
        <VisorFotos fotos={visor.fotos} indice={visor.indice} onCambiar={cambiarFoto} onCerrar={cerrarVisor} />
      )}
    </div>
  );
}
