import { pool } from '../config/db.js';

async function insertarArchivo(client, publicacionId, conceptoId, archivo) {
  await client.query(
    `INSERT INTO archivos_transparencia (publicacion_id, concepto_id, rol, url_archivo, mime_type, nombre_original)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [publicacionId, conceptoId, archivo.rol, archivo.url_archivo, archivo.mime_type, archivo.nombre_original]
  );
}

// CU-12: publicación + conceptos + archivos en una sola transacción.
// Si cualquier INSERT falla se hace ROLLBACK y no queda nada a medias.
export async function insertarPublicacion({ titulo, descripcion, fechaGasto, autorId, conceptos, comprobantesGenerales }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const publicacion = await client.query(
      `INSERT INTO publicaciones_transparencia (titulo, descripcion, fecha_gasto, autor_id)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4)
       RETURNING id, titulo`,
      [titulo, descripcion ?? null, fechaGasto ?? null, autorId]
    );
    const { id } = publicacion.rows[0];
    for (const concepto of conceptos) {
      const result = await client.query(
        `INSERT INTO conceptos_gasto (publicacion_id, nombre, mensaje, monto, categoria)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [id, concepto.nombre, concepto.mensaje ?? null, concepto.monto, concepto.categoria]
      );
      for (const archivo of concepto.archivos) {
        await insertarArchivo(client, id, result.rows[0].id, archivo);
      }
    }
    for (const archivo of comprobantesGenerales) {
      await insertarArchivo(client, id, null, archivo);
    }
    // El total no se guarda: siempre se calcula con SUM(monto)
    const total = await client.query(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM conceptos_gasto
       WHERE publicacion_id = $1`,
      [id]
    );
    await client.query('COMMIT');
    return { ...publicacion.rows[0], total: total.rows[0].total };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Si la conexión ya se cayó no hay nada que deshacer; se reporta el error original
    }
    throw err;
  } finally {
    client.release();
  }
}

// Filtro opcional: publicaciones con al menos un concepto de la categoría
function filtroCategoria(categoria, params) {
  if (!categoria) return '';
  params.push(categoria);
  return ` WHERE EXISTS (
      SELECT 1 FROM conceptos_gasto cg
      WHERE cg.publicacion_id = p.id AND cg.categoria = $${params.length}
    )`;
}

// CU-12: una página de publicaciones (más recientes primero) con su total.
// total_registros (COUNT(*) OVER()) es el número de publicaciones sin paginar.
export async function listarPublicaciones({ limite, offset, categoria }) {
  const params = [limite, offset];
  const where = filtroCategoria(categoria, params);
  const result = await pool.query(
    `SELECT p.id, p.titulo, p.descripcion,
            TO_CHAR(p.fecha_gasto, 'YYYY-MM-DD') AS fecha_gasto, p.fecha_publicacion,
            COALESCE(SUM(c.monto), 0) AS total,
            COUNT(*) OVER() AS total_registros
     FROM publicaciones_transparencia p
     LEFT JOIN conceptos_gasto c ON c.publicacion_id = p.id${where}
     GROUP BY p.id
     ORDER BY p.fecha_publicacion DESC, p.id DESC
     LIMIT $1 OFFSET $2`,
    params
  );
  return result.rows;
}

// Solo se usa cuando la página pedida ya no tiene publicaciones (no llega total_registros)
export async function contarPublicaciones({ categoria } = {}) {
  const params = [];
  const where = filtroCategoria(categoria, params);
  const result = await pool.query(
    `SELECT COUNT(*) AS total FROM publicaciones_transparencia p${where}`,
    params
  );
  return Number(result.rows[0].total);
}

export async function listarConceptosDePublicaciones(publicacionIds) {
  const result = await pool.query(
    `SELECT id, publicacion_id, nombre, mensaje, monto, categoria
     FROM conceptos_gasto
     WHERE publicacion_id = ANY($1)
     ORDER BY id`,
    [publicacionIds]
  );
  return result.rows;
}

export async function listarArchivosDePublicaciones(publicacionIds) {
  const result = await pool.query(
    `SELECT id, publicacion_id, concepto_id, rol, url_archivo, mime_type, nombre_original
     FROM archivos_transparencia
     WHERE publicacion_id = ANY($1)
     ORDER BY id`,
    [publicacionIds]
  );
  return result.rows;
}
