import jwt from 'jsonwebtoken';

// Utilidad generica para generar el JWT tras un login exitoso (CU-01).
// El "payload" tipicamente lleva { id, rol } para que el resto del sistema
// sepa quien es el usuario y si es admin o residente.
export function generarToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}
