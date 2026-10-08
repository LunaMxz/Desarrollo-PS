import { useEffect, useRef, useState } from 'react';
import apiClient, { listarResidentes } from '../api/client';
import AdminHeader from '../components/AdminHeader';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import './AdminDashboardPage.css';
import './GenerarCargosPage.css';
import './RegistrarPagoPage.css';

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const alturas = [16, 22, 19, 28, 24, 32, 26, 30, 22, 25, 18];
const errorMensaje = (err) => err.response?.data?.error || 'No se pudo completar la solicitud. Verifica tu conexión e intenta de nuevo.';

export default function RegistrarPagoPage() {
  const [unidades, setUnidades] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [unidad, setUnidad] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [cargoId, setCargoId] = useState(null);
  const [monto, setMonto] = useState('');
  const [cargandoUnidades, setCargandoUnidades] = useState(true);
  const [errorUnidades, setErrorUnidades] = useState('');
  const [intento, setIntento] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [errorCargos, setErrorCargos] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [hora, setHora] = useState(() => new Date().getHours());
  const peticion = useRef(0);
  const enviando = useRef(false);
  const cargo = cargos.find((item) => item.id === cargoId);
  const cielo = obtenerCieloParaHora(hora);

  useEffect(() => {
    const timer = setInterval(() => setHora(new Date().getHours() + new Date().getMinutes() / 60), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let activo = true;
    setCargandoUnidades(true);
    setErrorUnidades('');
    // La API no expone un catálogo de unidades: incluye residentes inactivos
    // para permitir cobrar cargos de unidades que ya desocuparon.
    listarResidentes(false).then((resultado) => {
      if (!activo) return;
      if (resultado.success) {
        const disponibles = new Map();
        resultado.residentes.forEach((r) => {
          if (r.unidad_id && r.unidad_identificador) disponibles.set(r.unidad_id, {
            id: r.unidad_id, identificador: r.unidad_identificador,
          });
        });
        setUnidades([...disponibles.values()]);
      } else setErrorUnidades(resultado.error);
      setCargandoUnidades(false);
    });
    return () => { activo = false; };
  }, [intento]);

  useEffect(() => () => { peticion.current += 1; }, []);

  async function seleccionarUnidad(seleccionada) {
    if (enviando.current) return;
    const solicitud = ++peticion.current;
    setUnidad(seleccionada);
    setCargoId(null);
    setCargos([]);
    setMonto('');
    setAviso(null);
    setErrorCargos('');
    setCargando(true);
    try {
      // El router de cargos por unidad está montado bajo /pagos.
      const { data } = await apiClient.get(`/pagos/unidades/${seleccionada.id}/cargos`);
      if (solicitud === peticion.current) setCargos(data.cargos);
    } catch (err) {
      if (solicitud === peticion.current) setErrorCargos(errorMensaje(err));
    } finally {
      if (solicitud === peticion.current) setCargando(false);
    }
  }

  async function registrar(event) {
    event.preventDefault();
    if (enviando.current || !cargo) return;
    if (cargo.estado === 'pagado') {
      setAviso({ tipo: 'duplicado', texto: 'El cargo ya está pagado.' });
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(monto) || Number(monto) <= 0 || !Number.isFinite(Number(monto))) {
      setAviso({ tipo: 'error', texto: 'Ingresa un monto mayor a cero con máximo dos decimales.' });
      return;
    }
    if (Number(monto) > Number(cargo.monto)) {
      setAviso({ tipo: 'error', texto: 'El pago no puede exceder el importe del cargo.' });
      return;
    }
    enviando.current = true;
    setGuardando(true);
    setAviso(null);
    try {
      const { data } = await apiClient.post('/pagos', { cargo_id: cargo.id, monto: Number(monto) });
      const actualizado = data.pago.cargo;
      setCargos((anteriores) => anteriores.map((item) => item.id === cargo.id ? actualizado : item));
      setMonto('');
      const fechaRegistrada = new Date(data.pago.fecha_pago).toLocaleDateString('es-MX');
      setAviso({ tipo: 'exito', texto: `Pago registrado. El cargo quedó ${actualizado.estado}. Fecha registrada: ${fechaRegistrada}.` });
    } catch (err) {
      if (err.response?.status === 409) {
        setCargos((anteriores) => anteriores.map((item) => item.id === cargo.id ? { ...item, estado: 'pagado' } : item));
        setAviso({ tipo: 'duplicado', texto: 'El cargo ya está pagado. No se registró otro pago.' });
      } else setAviso({ tipo: 'error', texto: errorMensaje(err) });
    } finally {
      enviando.current = false;
      setGuardando(false);
    }
  }

  const resultados = unidades.filter((u) => u.identificador.toLocaleLowerCase('es-MX').includes(busqueda.trim().toLocaleLowerCase('es-MX')));

  return (
    <div className="generar-cargos-screen registrar-pago-screen" style={{ '--sky-top': cielo.top, '--sky-bot': cielo.bot }}>
      <div className="fondo-cielo" aria-hidden="true" />
      <div className="fondo-skyline-back" aria-hidden="true">
        {alturas.map((altura, i) => <div key={i} className="bloque-back" style={{ height: `${altura * 3}%` }} />)}
      </div>
      <div className="fondo-skyline" aria-hidden="true">
        {alturas.map((altura, i) => <div key={i} className="torre" style={{ height: `${altura}vh`, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {Array.from({ length: 32 }, (_, j) => <div key={j} className={`ventana ${(j * 7 + i * 3) % 17 / 17 < obtenerProporcionLuces(hora) ? 'lit' : ''}`} />)}
        </div>)}
      </div>
      <div className="fondo-scrim" aria-hidden="true" /><div className="grain" aria-hidden="true" />
      <AdminHeader titulo="Cuotas y pagos" />
      <main className="generar-cargos-panel">
        <div className="generar-cargos-card registrar-pago-card">
          <h1 className="generar-cargos-card__title">Registrar pago</h1>
          <p className="generar-cargos-card__subtitle">Busca una unidad y selecciona el cargo que deseas abonar.</p>
          <label className="generar-cargos-form__field" htmlFor="buscar-unidad">Buscar por identificador
            <div className="generar-cargos-form__input"><input id="buscar-unidad" type="search" placeholder="Depto 301" value={busqueda} disabled={guardando} onChange={(e) => setBusqueda(e.target.value)} /></div>
          </label>
          {cargandoUnidades ? <p role="status">Cargando unidades…</p> : errorUnidades ? <div role="alert"><p>{errorUnidades}</p><button className="registrar-pago-opcion" onClick={() => setIntento((v) => v + 1)}>Reintentar</button></div> : <>
            <ul className="registrar-pago-unidades" aria-label="Unidades encontradas">
              {resultados.map((u) => <li key={u.id}><button className="registrar-pago-opcion" aria-pressed={unidad?.id === u.id} disabled={guardando} onClick={() => seleccionarUnidad(u)}>{u.identificador}</button></li>)}
            </ul>
            {resultados.length === 0 && <p role="status">No se encontraron unidades con ese identificador.</p>}
          </>}
          {unidad && <section aria-label="Cargos de la unidad">
            <h2 className="registrar-pago-titulo">Cargos de {unidad.identificador}</h2>
            {cargando ? <p role="status">Cargando cargos…</p> : errorCargos ? <div role="alert"><p>{errorCargos}</p><button className="registrar-pago-opcion" onClick={() => seleccionarUnidad(unidad)}>Reintentar</button></div> : <>
              {!cargos.some((c) => c.estado !== 'pagado') && <p role="status">Esta unidad no tiene cargos pendientes ni parciales.</p>}
              <ul className="registrar-pago-cargos">
                {cargos.map((c) => <li key={c.id}><button className="registrar-pago-opcion registrar-pago-cargo" aria-pressed={cargoId === c.id} disabled={guardando} onClick={() => {
                  setCargoId(c.id); setMonto('');
                  setAviso(c.estado === 'pagado' ? { tipo: 'duplicado', texto: 'El cargo ya está pagado.' } : null);
                }}><span><strong>{c.concepto}</strong><span className="registrar-pago-detalle">Periodo {c.periodo} · Importe del cargo: {moneda.format(c.monto)}</span></span><span className={`registrar-pago-estado registrar-pago-estado--${c.estado}`}>{c.estado}</span></button></li>)}
              </ul>
            </>}
          </section>}
          {aviso && <p className={`generar-cargos-aviso generar-cargos-aviso--${aviso.tipo}`} role={aviso.tipo === 'exito' ? 'status' : 'alert'}>{aviso.texto}</p>}
          {cargo && cargo.estado !== 'pagado' && <form className="generar-cargos-form" onSubmit={registrar}>
            <h2 className="registrar-pago-titulo">Capturar pago · {cargo.concepto}</h2>
            {cargo.estado === 'parcial' && <p className="registrar-pago-nota">El cargo tiene abonos previos. El importe mostrado es el total original; el saldo disponible se valida al registrar el pago.</p>}
            <label className="generar-cargos-form__field" htmlFor="pago-monto">Monto del pago
              <div className="generar-cargos-form__input"><span aria-hidden="true">$</span><input id="pago-monto" inputMode="decimal" placeholder="0.00" required value={monto} disabled={guardando} onChange={(e) => setMonto(e.target.value)} /></div>
            </label>
            <button className="generar-cargos-form__submit" disabled={guardando}>{guardando ? 'Registrando…' : 'Registrar pago'}</button>
          </form>}
        </div>
      </main>
    </div>
  );
}
