import { useEffect, useState } from 'react';
import { listarResidentes, darDeBajaResidente } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import './BajaResidentePage.css';

export default function BajaResidentePage() {
  const [residentes, setResidentes] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState('');

  // Residente seleccionado para confirmar la baja (null = modal cerrado)
  const [residenteABaja, setResidenteABaja] = useState(null);
  const [procesandoBaja, setProcesandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState('');
  const [avisoExito, setAvisoExito] = useState('');

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
    <div className="baja-residente-screen">
      <AdminHeader titulo="Baja de residente" />
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
