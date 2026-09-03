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
CREATE TYPE tipo_archivo AS ENUM ('pdf', 'jpg', 'png');

CREATE TABLE publicaciones_transparencia (
    id                SERIAL PRIMARY KEY,
    titulo            VARCHAR(150) NOT NULL,
    descripcion       TEXT,
    autor_id          INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_publicacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE archivos_transparencia (
    id              SERIAL PRIMARY KEY,
    publicacion_id  INTEGER NOT NULL REFERENCES publicaciones_transparencia(id),
    url_archivo     VARCHAR(255) NOT NULL,
    tipo_archivo    tipo_archivo NOT NULL,
    nombre_original VARCHAR(150) NOT NULL,
    fecha_subida    TIMESTAMP NOT NULL DEFAULT NOW()
);
