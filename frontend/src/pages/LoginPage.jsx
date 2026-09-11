import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

// Tres torres de apartamentos con distinta altura y separación
const EDIFICIOS = [
  { x: 40, ancho: 190, pisos: 15, seed: 1, medio: false },
  { x: 250, ancho: 260, pisos: 19, seed: 2, medio: true },
  { x: 540, ancho: 210, pisos: 12, seed: 3, medio: false },
];

function construirEdificio({ x, ancho, pisos, seed }) {
  const altoPiso = 46;
  const baseY = 900;
  const pisosArr = [];

  for (let p = 0; p < pisos; p++) {
    const y = baseY - (p + 1) * altoPiso;
    const numVentanas = Math.max(2, Math.floor(ancho / 34));
    const ventanas = [];
    for (let v = 0; v < numVentanas; v++) {
      const idx = p * 7 + v * 3 + seed;
      if (idx % 5 === 0) continue;
      ventanas.push({
        x: x + 14 + v * ((ancho - 28) / numVentanas),
        y: y + 14,
        acero: idx % 6 === 0,
        delay: `${((idx * 3) % 16) * 0.35}s`,
      });
    }
    pisosArr.push({
      key: `p-${p}`,
      x,
      y,
      ancho,
      alto: altoPiso - 3,
      delay: `${(pisos - p) * 35 + seed * 20}ms`,
      ventanas,
    });
  }
  return pisosArr;
}

export default function LoginPage() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cargando, setCargando] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Diccionario para redirigir según el rol del usuario
  const rutasPorRol = {
    admin: '/admin/dashboard',
    residente: '/residentes',
    guardia: '/bitacora',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Evita doble envío si el usuario hace doble click antes de que
    // React repinte el botón como disabled
    if (cargando) return;

    setErrorMsg('');
    setCargando(true);

    try {
      // trim() en el correo evita falsos "credenciales inválidas" por espacios
      // accidentales al copiar/pegar; la contraseña se envía tal cual la escribió el usuario
      const result = await login(correo.trim(), password);

      if (result.success) {
        // Redirige según el rol (si no coincide con ningún rol, va a /dashboard por defecto)
        const rolUsuario = result.user?.rol;
        const destino = rutasPorRol[rolUsuario] || '/dashboard';

        navigate(destino, { replace: true });
      } else {
        setErrorMsg(result.error);
      }
    } catch (err) {
      // Manejo defensivo: login() de client.js normalmente captura sus propios
      // errores y nunca lanza, pero se mantiene por si esa lógica cambia.
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setErrorMsg('El servidor tardó demasiado en responder. Intente más tarde.');
      } else {
        setErrorMsg('Ocurrió un error inesperado al intentar iniciar sesión.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-screen">
      {/* Fondo ilustrado */}
      <div className="fondo">
        <svg viewBox="0 0 800 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="cieloGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#131C31" />
              <stop offset="60%" stopColor="#212A3E" />
              <stop offset="100%" stopColor="#383E45" />
            </linearGradient>
          </defs>
          <rect width="800" height="900" fill="url(#cieloGrad)" />

          {EDIFICIOS.map((ed) => (
            <g key={ed.x}>
              {construirEdificio(ed).map((piso) => (
                <g key={piso.key}>
                  <rect
                    className={`bloque${ed.medio ? ' bloque--medio' : ''}`}
                    x={piso.x}
                    y={piso.y}
                    width={piso.ancho}
                    height={piso.alto}
                    style={{ animationDelay: piso.delay }}
                  />
                  <rect
                    className="balcon"
                    x={piso.x + 6}
                    y={piso.y + 8}
                    width={piso.ancho - 12}
                    height={24}
                  />
                  {piso.ventanas.map((v, i) => (
                    <rect
                      key={i}
                      className={`ventana${v.acero ? ' ventana--acero' : ''}`}
                      x={v.x}
                      y={v.y}
                      width="14"
                      height="18"
                      style={{ animationDelay: v.delay }}
                    />
                  ))}
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="fondo__scrim" aria-hidden="true" />

      {/* Marca inferior izquierda */}
      <div className="fondo__marca">
        <p className="fondo__eyebrow">Portal de residentes</p>
        <h2>Tu condominio, siempre a la mano</h2>
      </div>

      {/* Formulario de login */}
      <div className="login-panel">
        <div className="login-card">
          <h1 className="login-card__title">Bienvenido a casa</h1>
          <p className="login-card__subtitle">Ingresa para gestionar tu condominio</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-form__field" htmlFor="correo">
              <span>Correo electrónico</span>
              <input
                id="correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
                disabled={cargando}
              />
            </label>

            <label className="login-form__field" htmlFor="password">
              <span>Contraseña</span>
              <div className="login-form__password-wrapper">
                <input
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={cargando}
                />
                <button
                  type="button"
                  className="login-form__toggle-password"
                  onClick={() => setMostrarPassword((prev) => !prev)}
                  disabled={cargando}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={mostrarPassword}
                  tabIndex={-1}
                >
                  {mostrarPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </label>

            {errorMsg && (
              <p className="login-form__error" role="alert">
                {errorMsg}
              </p>
            )}

            <button type="submit" className="login-form__submit" disabled={cargando}>
              {cargando && <span className="spinner" aria-hidden="true" />}
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
