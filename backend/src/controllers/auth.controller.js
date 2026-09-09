import { login, registrar } from '../services/auth.service.js';
export async function loginUsuario(req, res, next) {
  try {
    const { correo, password } = req.body;
    if (!correo || !password) {
      const error = new Error('Correo y contraseña son obligatorios');
      error.status = 400;
      throw error;
    }
    const resultado = await login(correo, password);
    res.json({
      message: 'Login exitoso',
      ...resultado,
    });
  } catch (err) {
    if (err.message === 'Credenciales inválidas' || 
        err.message === 'Usuario inactivo. Contacte al administrador.') {
      err.status = 401;
    }
    if (err.message === 'No se pudo conectar con el servidor') {
      err.status = 503;
    }
    next(err);
  }
}
export async function registrarUsuario(req, res, next) {
  try {
    if (req.user?.rol !== 'admin') {
      const error = new Error('Solo administradores pueden crear usuarios');
      error.status = 403;
      throw error;
    }
    const { correo, password, unidad_id } = req.body;
    if (!correo || !password || !unidad_id) {
      const error = new Error('Correo, password y unidad_id son obligatorios');
      error.status = 400;
      throw error;
    }
    const nuevoUsuario = await registrar({ correo, password, unidad_id });
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: nuevoUsuario
    });
  } catch (err) {
    if (err.message === 'La unidad ya tiene un residente activo' ||
        err.message === 'El correo ya está registrado') {
      err.status = 400;
    }
    next(err);
  }
}