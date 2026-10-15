-- ============================================
-- Sistema de Gestion de Condominios
-- Esquema completo de base de datos (PostgreSQL)
-- ============================================

-- MODULO: Residentes / Usuarios (tabla base)
CREATE TYPE rol_usuario AS ENUM ('admin', 'residente');

CREATE TABLE unidades (
    id              SERIAL PRIMARY KEY,
    identificador   VARCHAR(20) NOT NULL UNIQUE,   -- ej. "Depto 301"
    fecha_creacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    correo          VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             rol_usuario NOT NULL,
    unidad_id       INTEGER REFERENCES unidades(id),  -- NULL si es admin
    activo          BOOLEAN NOT NULL DEFAULT TRUE,     -- soft delete (CU-05)
    fecha_creacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Regla CU-04/CU-05: una unidad solo puede tener UN residente activo
-- a la vez, pero conserva el historial de los que ya se dieron de baja
CREATE UNIQUE INDEX unidad_residente_activo_unico
ON usuarios (unidad_id)
WHERE rol = 'residente' AND activo = TRUE;

-- MODULO: Cuotas y pagos
CREATE TYPE estado_cargo AS ENUM ('pendiente', 'parcial', 'pagado');

CREATE TABLE cargos (
    id                SERIAL PRIMARY KEY,
    unidad_id         INTEGER NOT NULL REFERENCES unidades(id),
    concepto          VARCHAR(100) NOT NULL DEFAULT 'Cuota mensual',
    monto             NUMERIC(10,2) NOT NULL,
    periodo           CHAR(7) NOT NULL,        -- formato 'YYYY-MM'
    estado            estado_cargo NOT NULL DEFAULT 'pendiente',
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (unidad_id, periodo)                 -- evita duplicados (CU-06)
);

CREATE TABLE pagos (
    id               SERIAL PRIMARY KEY,
    cargo_id         INTEGER NOT NULL REFERENCES cargos(id),
    monto            NUMERIC(10,2) NOT NULL,
    fecha_pago       TIMESTAMP NOT NULL DEFAULT NOW(),
    registrado_por   INTEGER NOT NULL REFERENCES usuarios(id)
);

-- MODULO: Incidencias
CREATE TYPE estado_incidencia AS ENUM ('abierto', 'en_proceso', 'resuelto');

CREATE TABLE incidencias (
    id                SERIAL PRIMARY KEY,
    residente_id      INTEGER NOT NULL REFERENCES usuarios(id),
    titulo            VARCHAR(150) NOT NULL,
    descripcion       TEXT NOT NULL,
    ubicacion         VARCHAR(150),
    estado            estado_incidencia NOT NULL DEFAULT 'abierto',
    responsable       VARCHAR(150),      -- solo informativo, NO es cuenta de usuario
    fecha_creacion    TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_resolucion  TIMESTAMP
);

-- MODULO: Comunicados
CREATE TABLE comunicados (
    id                SERIAL PRIMARY KEY,
    titulo            VARCHAR(150) NOT NULL,
    contenido         TEXT NOT NULL,
    autor_id          INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_publicacion TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MODULO: Transparencia y finanzas
-- publicacion -> conceptos de gasto -> fotos y comprobantes (por concepto o generales)
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
