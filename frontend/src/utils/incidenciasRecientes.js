// CU-15: reglas de "Mis reportes" compartidas por la página y el inicio del residente.

export const DIAS_RECIENTE = 7;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const ETIQUETAS_ESTADO = {
  abierto: 'Abierta',
  en_proceso: 'En proceso',
  resuelto: 'Resuelta',
};

// "Actualizada": cambió después de reportarse (asignación o resolución)
// y ese cambio fue en los últimos 7 días.
export function esActualizada(incidencia, ahora = Date.now()) {
  const creada = Date.parse(incidencia?.fecha_creacion);
  const actualizada = Date.parse(incidencia?.fecha_actualizacion);
  if (Number.isNaN(creada) || Number.isNaN(actualizada)) return false;
  return actualizada > creada && ahora - actualizada <= DIAS_RECIENTE * MS_POR_DIA;
}

export function contarActualizadas(incidencias = [], ahora = Date.now()) {
  return incidencias.filter((incidencia) => esActualizada(incidencia, ahora)).length;
}

export function textoAvisoActualizadas(n) {
  return n === 1
    ? 'Tienes 1 reporte actualizado recientemente'
    : `Tienes ${n} reportes actualizados recientemente`;
}
