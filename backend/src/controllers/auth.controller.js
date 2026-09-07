import { login } from '../services/auth.service.js';
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
    next(err);
  }
}