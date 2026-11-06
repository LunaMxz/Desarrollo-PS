import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { marcarRecordatorioVisto, obtenerRecordatorioPendiente } from '../api/recordatorios.api';
import './RecordatorioPagoModal.css';

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

// CU-14: al entrar, si la administración le mandó un recordatorio de pago que aún no ha visto,
// el residente ve esta ventana. Al cerrarla se marca como vista y no vuelve a salir.
export default function RecordatorioPagoModal() {
  const navigate = useNavigate();
  const [recordatorio, setRecordatorio] = useState(null);
  const botonPrincipal = useRef(null);

  useEffect(() => {
    let vigente = true;
    obtenerRecordatorioPendiente()
      .then((resultado) => {
        if (vigente && resultado.success && resultado.recordatorio) setRecordatorio(resultado.recordatorio);
      })
      .catch(() => {}); // Si falla, el inicio se usa igual: el recordatorio saldrá la próxima vez
    return () => { vigente = false; };
  }, []);

  useEffect(() => {
    if (recordatorio) botonPrincipal.current?.focus();
  }, [recordatorio]);

  if (!recordatorio) return null;

  function cerrar(destino) {
    marcarRecordatorioVisto(recordatorio.id).catch(() => {});
    setRecordatorio(null);
    if (destino) navigate(destino);
  }

  const cargos = recordatorio.cargos_pendientes;

  return (
    <div className="recordatorio-overlay" role="presentation">
      <div
        className="recordatorio-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recordatorio-titulo"
        aria-describedby="recordatorio-texto"
        onKeyDown={(e) => { if (e.key === 'Escape') cerrar(); }}
      >
        <p className="recordatorio-modal__eyebrow">Recordatorio de la administración</p>
        <h2 id="recordatorio-titulo" className="recordatorio-modal__titulo">Tienes pagos pendientes</h2>
        <p id="recordatorio-texto" className="recordatorio-modal__texto">
          Tienes {cargos} {cargos === 1 ? 'cuota pendiente' : 'cuotas pendientes'} por un total de{' '}
          <strong>{moneda.format(recordatorio.adeudo)}</strong>. Te pedimos realizar tu pago lo antes
          posible para mantenerte al corriente.
        </p>
        <div className="recordatorio-modal__acciones">
          <button type="button" className="recordatorio-modal__secundario" onClick={() => cerrar()}>
            Entendido
          </button>
          <button
            type="button"
            ref={botonPrincipal}
            className="recordatorio-modal__principal"
            onClick={() => cerrar('/residentes/estado-cuenta')}
          >
            Ver mis cuotas
          </button>
        </div>
      </div>
    </div>
  );
}
