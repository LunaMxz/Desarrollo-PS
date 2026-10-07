import jwt from 'jsonwebtoken';

// Usuarios de ejemplo (tal como los regresa usuarios.repository.findById)
export const admin = {
  id: 1,
  correo: 'admin@condominio.com',
  rol: 'admin',
  unidad_id: null,
  activo: true,
};

export const residente = {
  id: 2,
  correo: 'residente@condominio.com',
  rol: 'residente',
  unidad_id: 10,
  activo: true,
};

export const residenteInactivo = {
  id: 3,
  correo: 'inactivo@condominio.com',
  rol: 'residente',
  unidad_id: 11,
  activo: false,
};

export const usuarios = [admin, residente, residenteInactivo];

// Implementación para mockear findById: busca en la lista de usuarios de ejemplo
export function findUsuarioPorId(id) {
  return Promise.resolve(usuarios.find((u) => u.id === Number(id)) ?? null);
}

export function tokenPara(usuario, opciones = {}) {
  return jwt.sign(
    { id: usuario.id, correo: usuario.correo, rol: usuario.rol, unidad_id: usuario.unidad_id },
    process.env.JWT_SECRET,
    { expiresIn: '1h', ...opciones }
  );
}

export function bearer(usuario) {
  return `Bearer ${tokenPara(usuario)}`;
}

// Incidencia de ejemplo (tal como la regresa incidencias.repository)
export function crearIncidenciaFake(sobrescribir = {}) {
  return {
    id: 100,
    residente_id: residente.id,
    titulo: 'Fuga de agua',
    descripcion: 'Hay una fuga en el pasillo del edificio B',
    ubicacion: 'Edificio B',
    estado: 'abierto',
    responsable: null,
    fecha_creacion: '2026-09-20T10:00:00.000Z',
    fecha_resolucion: null,
    ...sobrescribir,
  };
}

// Cargo de ejemplo (tal como lo regresa cargos.repository)
export function crearCargoFake(sobrescribir = {}) {
  return {
    id: 500,
    unidad_id: residente.unidad_id,
    concepto: 'Cuota mensual',
    monto: '1500.00',
    periodo: '2026-10',
    estado: 'pendiente',
    fecha_generacion: '2026-10-01T10:00:00.000Z',
    ...sobrescribir,
  };
}

// Error de cargo duplicado (tal como lo lanza pg por el índice único unidad_id + periodo)
export function errorCargoDuplicado() {
  const error = new Error('duplicate key value violates unique constraint "cargos_unidad_id_periodo_key"');
  error.code = '23505';
  return error;
}
