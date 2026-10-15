-- ============================================
-- Migracion 002 - Modulo de Transparencia (CU-12 rediseñado)
-- Ejecutar UNA vez por cada miembro del equipo en su base local.
--
-- Cambio de modelo:
--   ANTES: publicacion -> archivos sueltos
--   AHORA: publicacion -> conceptos de gasto (banca, pintura, etc.)
--                         -> fotos y comprobantes (por concepto o generales)
--
-- Es seguro borrar las tablas viejas: ningun codigo las usaba todavia.
--
-- Se puede ejecutar varias veces (reinicia SOLO las tablas de transparencia).
-- Todo va en una transaccion: si algo falla, no queda la base a medias.
-- ============================================

BEGIN;

-- Orden: primero las tablas hijas, luego las padres, luego los tipos
DROP TABLE IF EXISTS archivos_transparencia;
DROP TABLE IF EXISTS conceptos_gasto;
DROP TABLE IF EXISTS publicaciones_transparencia;
DROP TYPE  IF EXISTS tipo_archivo;      -- tipo del diseño anterior
DROP TYPE  IF EXISTS rol_archivo;
DROP TYPE  IF EXISTS categoria_gasto;

CREATE TYPE categoria_gasto AS ENUM (
    'mantenimiento', 'limpieza', 'seguridad', 'servicios', 'mejoras', 'otros'
);

CREATE TYPE rol_archivo AS ENUM ('foto', 'comprobante');

-- Una publicacion = un "reporte de gasto" (ej. "Mejoras del jardin - Octubre")
CREATE TABLE publicaciones_transparencia (
    id                SERIAL PRIMARY KEY,
    titulo            VARCHAR(150) NOT NULL,
    descripcion       TEXT,
    fecha_gasto       DATE NOT NULL DEFAULT CURRENT_DATE,   -- cuando se hizo el gasto
    autor_id          INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_publicacion TIMESTAMP NOT NULL DEFAULT NOW()      -- cuando se publico
);

-- Cada renglon del gasto: "Banca de jardin - $2,500"
-- El total de la publicacion NO se guarda: se calcula con SUM(monto)
CREATE TABLE conceptos_gasto (
    id             SERIAL PRIMARY KEY,
    publicacion_id INTEGER NOT NULL
                   REFERENCES publicaciones_transparencia(id) ON DELETE CASCADE,
    nombre         VARCHAR(150) NOT NULL,
    mensaje        TEXT,
    monto          NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    categoria      categoria_gasto NOT NULL DEFAULT 'otros'
);

-- Fotos y comprobantes (facturas/tickets).
-- concepto_id NULL = comprobante GENERAL (un ticket que cubre varios conceptos)
CREATE TABLE archivos_transparencia (
    id              SERIAL PRIMARY KEY,
    publicacion_id  INTEGER NOT NULL
                    REFERENCES publicaciones_transparencia(id) ON DELETE CASCADE,
    concepto_id     INTEGER
                    REFERENCES conceptos_gasto(id) ON DELETE CASCADE,
    rol             rol_archivo NOT NULL,
    url_archivo     VARCHAR(255) NOT NULL,   -- ruta relativa, ej. /uploads/transparencia/uuid.jpg
    mime_type       VARCHAR(50)  NOT NULL,   -- image/jpeg, image/png, application/pdf
    nombre_original VARCHAR(150) NOT NULL,
    fecha_subida    TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Una foto siempre pertenece a un concepto; solo un comprobante puede ser general
    CONSTRAINT foto_requiere_concepto CHECK (concepto_id IS NOT NULL OR rol = 'comprobante')
);

CREATE INDEX idx_conceptos_publicacion ON conceptos_gasto(publicacion_id);
CREATE INDEX idx_archivos_publicacion  ON archivos_transparencia(publicacion_id);
CREATE INDEX idx_archivos_concepto     ON archivos_transparencia(concepto_id);
CREATE INDEX idx_publicaciones_fecha   ON publicaciones_transparencia(fecha_publicacion DESC);

COMMIT;
