import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticacion (CU-01 / CU-05).
 * Valida el JWT enviado en el header Authorization: Bearer <token>.
 *
 * TODO (equipo backend, CU-05): antes de dejar pasar el request, consultar
 * la tabla usuarios y verificar que activo = true para el id del payload.
 * Asi, dar de baja a un residente revoca su acceso de inmediato aunque
 * su token no haya expirado todavia.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}
