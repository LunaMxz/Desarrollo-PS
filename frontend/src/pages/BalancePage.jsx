import { useEffect, useState } from 'react';
import AdminHeader from '../components/AdminHeader';
import ResumenBalance from '../components/ResumenBalance';
import { obtenerCieloParaHora, obtenerProporcionLuces } from '../utils/coloresHorario';
import './ComunicadosPage.css';

const ALTURAS = [16, 22, 19, 28, 24, 32, 26, 30, 22, 25, 18];

export default function BalancePage() {
  const [hora, setHora] = useState(() => {
    const hoy = new Date();
    return hoy.getHours() + hoy.getMinutes() / 60;
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const hoy = new Date();
      setHora(hoy.getHours() + hoy.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const cielo = obtenerCieloParaHora(hora);
  const luces = obtenerProporcionLuces(hora);
  return (
    <div className="comunicados-page" style={{ '--sky-top': cielo.top, '--sky-bot': cielo.bot }}>
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

      <AdminHeader titulo="Transparencia" />
      <main className="comunicados-contenido">
        <div className="comunicados-panel">
          <ResumenBalance mostrarPorCobrar={true} />
        </div>
      </main>
    </div>
  );
}
