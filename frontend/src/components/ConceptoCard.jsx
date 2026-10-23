import { useEffect, useState } from 'react';
import {
  CATEGORIAS,
  TIPOS_ARCHIVO,
  formatearTamano,
  limpiarMonto,
  mismoArchivo,
  separarArchivos,
} from '../utils/archivosTransparencia';
import './ConceptoCard.css';

function Miniatura({ archivo, onQuitar, deshabilitado }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const nueva = URL.createObjectURL(archivo);
    setUrl(nueva);
    return () => URL.revokeObjectURL(nueva); // libera memoria al quitar o desmontar
  }, [archivo]);

  return (
    <li className="cg-foto">
      {url && <img src={url} alt={archivo.name} />}
      <button
        type="button"
        className="cg-foto__quitar"
        onClick={onQuitar}
        disabled={deshabilitado}
        aria-label={`Quitar ${archivo.name}`}
      >
        ×
      </button>
    </li>
  );
}

// Lista de archivos con nombre, peso y botón para quitar (también la usa la página)
export function ListaArchivos({ archivos, onQuitar, deshabilitado }) {
  if (archivos.length === 0) return null;
  return (
    <ul className="cg-archivos">
      {archivos.map((archivo, i) => (
        <li key={`${archivo.name}-${archivo.lastModified}-${i}`} className="cg-archivo">
          <span className="cg-archivo__nombre">{archivo.name}</span>
          <span className="cg-archivo__peso">{formatearTamano(archivo.size)}</span>
          <button
            type="button"
            className="cg-archivo__quitar"
            onClick={() => onQuitar(i)}
            disabled={deshabilitado}
            aria-label={`Quitar ${archivo.name}`}
          >
            Quitar
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ConceptoCard({
  concepto,
  numero,
  puedeQuitar,
  bloqueado,
  errores = {},
  onCambio,
  onQuitar,
}) {
  const [avisoFotos, setAvisoFotos] = useState('');
  const [avisoComprobantes, setAvisoComprobantes] = useState('');
  const idBase = `concepto-${concepto.id}`;

  const agregarArchivos = (tipo, campo, setAviso) => (e) => {
    const { validos, errores: invalidos } = separarArchivos(Array.from(e.target.files), tipo);
    const nuevos = validos.filter((f) => !concepto[campo].some((existente) => mismoArchivo(existente, f)));
    if (nuevos.length > 0) onCambio(concepto.id, { [campo]: [...concepto[campo], ...nuevos] });
    setAviso(invalidos.join(' '));
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };

  const quitarArchivo = (campo) => (indice) =>
    onCambio(concepto.id, { [campo]: concepto[campo].filter((_, i) => i !== indice) });

  return (
    <fieldset className="cg-card" disabled={bloqueado}>
      <legend className="cg-card__titulo">Concepto {numero}</legend>

      <div className="cg-grid">
        <label className="cg-campo cg-campo--ancho" htmlFor={`${idBase}-nombre`}>
          <span>Nombre del concepto *</span>
          <input
            id={`${idBase}-nombre`}
            type="text"
            maxLength={150}
            value={concepto.nombre}
            onChange={(e) => onCambio(concepto.id, { nombre: e.target.value })}
            placeholder="Ej. Banca de jardín"
            aria-invalid={Boolean(errores.nombre)}
          />
          {errores.nombre && <span className="cg-error" role="alert">{errores.nombre}</span>}
        </label>

        <label className="cg-campo" htmlFor={`${idBase}-monto`}>
          <span>Monto *</span>
          <div className="cg-monto">
            <span aria-hidden="true">$</span>
            <input
              id={`${idBase}-monto`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={concepto.monto}
              onChange={(e) => onCambio(concepto.id, { monto: limpiarMonto(e.target.value) })}
              placeholder="0.00"
              aria-invalid={Boolean(errores.monto)}
            />
          </div>
          {errores.monto && <span className="cg-error" role="alert">{errores.monto}</span>}
        </label>

        <label className="cg-campo" htmlFor={`${idBase}-categoria`}>
          <span>Categoría</span>
          <select
            id={`${idBase}-categoria`}
            value={concepto.categoria}
            onChange={(e) => onCambio(concepto.id, { categoria: e.target.value })}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
        </label>

        <label className="cg-campo cg-campo--ancho" htmlFor={`${idBase}-mensaje`}>
          <span>Mensaje para los residentes</span>
          <textarea
            id={`${idBase}-mensaje`}
            rows={2}
            value={concepto.mensaje}
            onChange={(e) => onCambio(concepto.id, { mensaje: e.target.value })}
            placeholder="Opcional: explica en qué se usó este gasto"
          />
        </label>
      </div>

      <div className="cg-seccion">
        <div className="cg-seccion__cabecera">
          <h3>Fotos</h3>
          <label className="cg-subir">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png"
              onChange={agregarArchivos('foto', 'fotos', setAvisoFotos)}
            />
            <span>+ Agregar fotos</span>
          </label>
        </div>
        <p className="cg-ayuda">{TIPOS_ARCHIVO.foto.etiqueta} · máximo 5 MB por archivo</p>
        {avisoFotos && <p className="cg-error" role="alert">{avisoFotos}</p>}
        {concepto.fotos.length > 0 && (
          <ul className="cg-fotos">
            {concepto.fotos.map((foto, i) => (
              <Miniatura
                key={`${foto.name}-${foto.lastModified}-${i}`}
                archivo={foto}
                onQuitar={() => quitarArchivo('fotos')(i)}
                deshabilitado={bloqueado}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="cg-seccion">
        <div className="cg-seccion__cabecera">
          <h3>Facturas y tickets</h3>
          <label className="cg-subir">
            <input
              type="file"
              multiple
              accept=".pdf,.xml,application/pdf,text/xml,application/xml"
              onChange={agregarArchivos('comprobante', 'comprobantes', setAvisoComprobantes)}
            />
            <span>+ Agregar comprobantes</span>
          </label>
        </div>
        <p className="cg-ayuda">{TIPOS_ARCHIVO.comprobante.etiqueta} · máximo 5 MB por archivo</p>
        {avisoComprobantes && <p className="cg-error" role="alert">{avisoComprobantes}</p>}
        <ListaArchivos
          archivos={concepto.comprobantes}
          onQuitar={quitarArchivo('comprobantes')}
          deshabilitado={bloqueado}
        />
      </div>

      {puedeQuitar && (
        <button type="button" className="cg-quitar-concepto" onClick={() => onQuitar(concepto.id)}>
          Quitar concepto
        </button>
      )}
    </fieldset>
  );
}