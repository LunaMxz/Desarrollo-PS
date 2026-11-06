// CU-13: datos temporales según el contrato de GET /transparencia/balance.
// Octubre: movimientos; noviembre: déficit; otros meses: sin movimientos.
export function obtenerBalancePrueba(anio, mes) {
  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
  const octubre = periodo === '2026-10';
  const noviembre = periodo === '2026-11';
  return {
    anio: Number(anio),
    mes: Number(mes),
    ingresos: octubre ? 12000 : noviembre ? 2000 : 0,
    egresos: octubre ? 8000 : noviembre ? 7000 : 0,
    saldo_mes: octubre ? 4000 : noviembre ? -5000 : 0,
    saldo_acumulado: periodo < '2026-10' ? 0 : octubre ? 4000 : -1000,
    egresos_por_categoria: octubre || noviembre ? [
      { categoria: 'mantenimiento', total: octubre ? 6000 : 5000 },
      { categoria: 'servicios', total: 2000 },
    ] : [],
    por_cobrar: 3500,
    unidades_con_adeudo: 2,
  };
}
