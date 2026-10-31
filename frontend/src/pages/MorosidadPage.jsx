import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerMorosidad } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import './AdminDashboardPage.css';
import './GenerarCargosPage.css';
import './MorosidadPage.css';

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const ALTURAS = [16, 22, 19, 28, 24, 32, 26, 30, 22, 25, 18];

// "Más de 2 meses" consulta con min_meses=3 (el backend usa >=)
const FILTROS = [
  { id: 'todas', etiqueta: 'Todas', minMeses: undefined },
  { id: 'mas2', etiqueta: 'Más de 2 meses', minMeses: 3 },
];

// CU-14: el administrador consulta las unidades con adeudo y puede iniciar el cobro.
export default function MorosidadPage() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState(FILTROS[0]);
  const [unidades, setUnidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const peticion = useRef(0); // descarta respuestas viejas al cambiar de filtro
  const [hora, setHora] = useState(() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setHora(d.getHours() + d.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const cargar = useCallback(async () => {
    const solicitud = ++peticion.current;
    setCargando(true);
    setError('');
    const resultado = await obtenerMorosidad(filtro.minMeses);
    if (solicitud !== peticion.current) return;
    if (resultado.success) setUnidades(resultado.unidades);
    else setError(resultado.error);
    setCargando(false);
  }, [filtro]);

  useEffect(() => {
    cargar();
    return () => { peticion.current += 1; };
  }, [cargar]);

  // Mayor adeudo primero
  const ordenadas = useMemo(
    () => [...unidades].sort((a, b) => Number(b.adeudo) - Number(a.adeudo)),
    [unidades]
  );
  const totalCentavos = ordenadas.reduce((s, u) => s + Math.round(Number(u.adeudo) * 100), 0);

  const cielo = obtenerCieloParaHora(hora);
  const luces = obtenerProporcionLuces(hora);

  return (
    <div className="generar-cargos-screen" style={{ '--sky-top': cielo.top, '--sky-bot': cielo.bot }}>
      <div className="fondo-cielo" aria-hidden="true" />
      <div className="fondo-skyline-back" aria-hidden="true">
        {ALTURAS.map((a, i) => <div key={i} className="bloque-back" style={{ height: `${a * 3}%` }} />)}
      </div>
      <div className="fondo-skyline" aria-hidden="true">
        {ALTURAS.map((a, i) => (
          <div key={i} className="torre" style={{ height: `${a}vh`, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {Array.from({ length: 32 }, (_, j) => (
              <div key={j} className={`ventana ${((j * 7 + i * 3) % 17) / 17 < luces ? 'lit' : ''}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="fondo-scrim" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <AdminHeader titulo="Cuotas y pagos" />

      <main className="generar-cargos-panel">
        <div className="generar-cargos-card mo-card">
          <h1 className="generar-cargos-card__title">Reporte de morosidad</h1>
          <p className="generar-cargos-card__subtitle">
            Unidades con cargos pendientes o parciales. Presiona Cobrar para registrar un pago.
          </p>

          <dl className="mo-resumen">
            <div>
              <dt>Total por cobrar</dt>
              <dd data-testid="total-adeudo">{moneda.format(totalCentavos / 100)}</dd>
            </div>
            <div>
              <dt>Unidades con adeudo</dt>
              <dd data-testid="total-unidades">{ordenadas.length}</dd>
            </div>
          </dl>

          <div className="mo-filtros" role="group" aria-label="Filtrar por meses de adeudo">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="mo-chip"
                aria-pressed={filtro.id === f.id}
                onClick={() => setFiltro(f)}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>

          {cargando && <p role="status">Cargando morosidad…</p>}

          {!cargando && error && (
            <div className="mo-error" role="alert">
              <p>{error}</p>
              <button type="button" className="mo-chip" onClick={cargar}>Reintentar</button>
            </div>
          )}

          {!cargando && !error && ordenadas.length === 0 && (
            <p className="mo-vacio" role="status">Ninguna unidad tiene adeudos 🎉</p>
          )}

          {!cargando && !error && ordenadas.length > 0 && (
            <div className="mo-tabla-contenedor">
              <table className="mo-tabla">
                <thead>
                  <tr>
                    <th scope="col">Unidad</th>
                    <th scope="col">Residente</th>
                    <th scope="col" className="mo-num">Meses</th>
                    <th scope="col" className="mo-num">Adeudo</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((u) => (
                    <tr key={u.unidad_id}>
                      <td>{u.unidad_identificador}</td>
                      <td>{u.residente_correo || 'Sin residente activo'}</td>
                      <td className="mo-num">{u.meses_adeudados}</td>
                      <td className="mo-num">{moneda.format(Number(u.adeudo))}</td>
                      <td>
                        <button
                          type="button"
                          className="mo-cobrar"
                          onClick={() => navigate('/admin/pagos/registrar', { state: { unidadId: u.unidad_id } })}
                        >
                          Cobrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}