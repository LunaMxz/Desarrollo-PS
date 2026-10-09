// Formatos para el estado de cuenta del residente (CU-07).

const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export const ESTADOS_CARGO = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
};

// 1500 | '1500.00' -> '$1,500.00'. Un valor no numérico se muestra como $0.00.
export function formatearMonto(valor) {
  const numero = Number(valor);
  return formatoMoneda.format(Number.isFinite(numero) ? numero : 0);
}

// '2026-10' -> 'Octubre 2026'
export function formatearPeriodo(periodo) {
  const [anio, mes] = String(periodo ?? '').split('-').map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return String(periodo ?? '');
  // Se arma a mano: según el navegador, toLocaleDateString da 'octubre 2026' u 'octubre de 2026'
  const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long' });
  return `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} ${anio}`;
}

// '2026-10-05T16:30:00.000Z' -> '5 oct 2026' (en la zona horaria del navegador)
export function formatearFecha(fecha) {
  const d = new Date(fecha);
  if (!fecha || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function etiquetaEstado(estado) {
  return ESTADOS_CARGO[estado] ?? estado ?? '—';
}
