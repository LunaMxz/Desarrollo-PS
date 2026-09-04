import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Usar en CU-04 (alta de residente) para no guardar contraseñas en texto plano.
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Usar en CU-01 (login) para comparar la contraseña ingresada contra el hash guardado.
export async function compararPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
