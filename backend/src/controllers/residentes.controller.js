// controllers/residentes.controller.js
import {
  crearResidente,
  listar,
  obtenerDetalle,
  desactivar,
  cambiarRol,
} from '../services/residentes.service.js';

export async function crearResidenteHandler(req, res, next) {
  try {
    const { correo, password, unidad_id } = req.body;
    if (!correo || !password || !unidad_id) {
      const error = new Error('Correo, password y unidad_id son obligatorios');
      error.status = 400;
      throw error;
    }
    const nuevoResidente = await crearResidente({ correo, password, unidad_id });
    res.status(201).json({
      message: 'Residente creado exitosamente',
      residente: nuevoResidente,
    });
  } catch (err) {
    if (
      err.message === 'La unidad ya tiene un residente activo' ||
      err.message === 'El correo ya está registrado'
    ) {
      err.status = 400;
    }
    next(err);
  }
}

export async function listarResidentesHandler(req, res, next) {
  try {
    const soloActivos = req.query.soloActivos !== 'false';
    const residentes = await listar({ soloActivos });
    res.json({ residentes });
  } catch (err) {
    next(err);
  }
}

export async function obtenerResidenteHandler(req, res, next) {
  try {
    const residente = await obtenerDetalle(req.params.id);
    res.json({ residente });
  } catch (err) {
    if (err.message === 'Residente no encontrado') {
      err.status = 404;
    }
    next(err);
  }
}

export async function desactivarResidenteHandler(req, res, next) {
  try {
    const residente = await desactivar(req.params.id, req.user.id);
    res.json({
      message: 'Residente desactivado exitosamente',
      residente,
    });
  } catch (err) {
    if (
      err.message === 'Usuario no encontrado' ||
      err.message === 'No se puede desactivar a un administrador' ||
      err.message === 'No puedes desactivarte a ti mismo'
    ) {
      err.status = 400;
    }
    next(err);
  }
}

export async function cambiarRolHandler(req, res, next) {
  try {
    const { rol } = req.body;
    if (!rol) {
      const error = new Error('El campo rol es obligatorio');
      error.status = 400;
      throw error;
    }
    const residente = await cambiarRol(req.params.id, rol, req.user.id);
    res.json({
      message: 'Rol actualizado exitosamente',
      residente,
    });
  } catch (err) {
    if (
      err.message === 'Usuario no encontrado' ||
      err.message === 'Rol inválido. Debe ser "admin" o "residente"' ||
      err.message === 'No tienes permiso para modificar a otro administrador'
    ) {
      err.status = 400;
    }
    next(err);
  }
}
