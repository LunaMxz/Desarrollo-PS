import jwt from 'jsonwebtoken';
import { validarCredenciales } from '../services/auth.service.js';
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await validarCredenciales(payload.id);
    req.user = {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
      unidad_id: usuario.unidad_id,
    };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    if (err.message === 'Usuario inactivo') {
      return res.status(401).json({ error: 'Usuario inactivo. Contacte al administrador.' });
    }   
    return res.status(401).json({ error: err.message || 'Error de autenticación' });
  }
}
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}