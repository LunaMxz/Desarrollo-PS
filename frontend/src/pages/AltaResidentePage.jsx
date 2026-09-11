import { useState } from 'react';
import { crearResidente } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import './AltaResidentePage.css';

export default function AltaResidentePage() {
  const [correo, setCorreo] = useState('');
  const [unidad, setUnidad] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null); // { residente, passwordTemporal }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Evita doble envío si el usuario hace doble click antes de que
    // React repinte el botón como disabled
    if (cargando) return;

    const correoLimpio = correo.trim();
    const unidadLimpia = unidad.trim();

    // Ningún campo puede quedar vacío antes de llamar a la API
    if (!correoLimpio || !unidadLimpia) {
      setErrorMsg('Correo y unidad son obligatorios.');
      return;
    }

    setErrorMsg('');
    setResultado(null);
    setCargando(true);

    try {
      // unidad_id llega al backend como entero (FK a unidades.id)
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
    <div className="alta-residente-screen">
      <AdminHeader titulo="Alta de residente" />
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
