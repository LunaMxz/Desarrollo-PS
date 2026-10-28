import { pool } from '../config/db.js';
// CU-06: inserta un cargo nuevo; siempre inicia en estado 'pendiente'
export async function insertarCargo({ unidad_id, concepto, monto, periodo }) {
  const result = await pool.query(
    `INSERT INTO cargos (unidad_id, concepto, monto, periodo, estado)
     VALUES ($1, $2, $3, $4, 'pendiente')
     RETURNING id, unidad_id, concepto, monto, periodo, estado, fecha_generacion`,
    [unidad_id, concepto, monto, periodo]
  );
  return result.rows[0];
}
// CU-14: Consulta para obtener el adeudo por unidad, incluyendo el correo del residente y la cantidad de meses adeudados
export async function obtenerAdeudoPorUnidad() {
  const result = await pool.query(
    `SELECT
       u.id                         AS unidad_id,
       u.identificador              AS unidad_identificador,
       residente.correo             AS residente_correo,
       COUNT(c.id)::int             AS meses_adeudados,
       SUM(c.monto - COALESCE(pagado.total_abonado, 0))::numeric AS adeudo
     FROM cargos c
     JOIN unidades u
       ON u.id = c.unidad_id
     LEFT JOIN (
       SELECT cargo_id, SUM(monto) AS total_abonado
       FROM pagos
       GROUP BY cargo_id
     ) pagado
       ON pagado.cargo_id = c.id
     LEFT JOIN usuarios residente
       ON residente.unidad_id = u.id
      AND residente.rol = 'residente'
      AND residente.activo = TRUE
     WHERE c.estado IN ('pendiente', 'parcial')
     GROUP BY u.id, u.identificador, residente.correo
     ORDER BY adeudo DESC`
  );
  return result.rows;
}
// CU-14: Consulta para obtener el total por cobrar y la cantidad de unidades con adeudo
export async function obtenerTotalPorCobrar() {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(c.monto - COALESCE(pagado.total_abonado, 0)), 0)::numeric AS total,
       COUNT(DISTINCT c.unidad_id)::int                                      AS unidades
     FROM cargos c
     LEFT JOIN (
       SELECT cargo_id, SUM(monto) AS total_abonado
       FROM pagos
       GROUP BY cargo_id
     ) pagado
       ON pagado.cargo_id = c.id
     WHERE c.estado IN ('pendiente', 'parcial')`
  );
  const fila = result.rows[0];
  return {
    total: fila.total,
    unidades: fila.unidades,
  };
}