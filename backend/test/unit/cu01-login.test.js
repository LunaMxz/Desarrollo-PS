// CU-01: Login (residentes y administradores)
// Pruebas unitarias de auth.service (login / validarCredenciales)
// y del middleware de autenticación (requireAuth / requireAdmin).
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/utils/password.util.js');

import { login, validarCredenciales } from '../../src/services/auth.service.js';
import { requireAuth, requireAdmin } from '../../src/middlewares/auth.middleware.js';
import { findByCorreo, findById } from '../../src/repositories/usuarios.repository.js';
import { compararPassword } from '../../src/utils/password.util.js';
import { admin, residente, residenteInactivo, findUsuarioPorId, tokenPara } from '../helpers/fixtures.js';

const usuarioConHash = { ...residente, password_hash: '$2b$10$hash', fecha_creacion: '2026-01-01' };

describe('CU-01 Login - auth.service.login', () => {
  it('regresa un token JWT y el usuario sin password_hash cuando las credenciales son válidas', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(usuarioConHash);
    vi.mocked(compararPassword).mockResolvedValue(true);

    const resultado = await login(residente.correo, 'Secreta123');

    expect(findByCorreo).toHaveBeenCalledWith(residente.correo);
    expect(compararPassword).toHaveBeenCalledWith('Secreta123', usuarioConHash.password_hash);
    expect(resultado.usuario).not.toHaveProperty('password_hash');
    expect(resultado.usuario).toMatchObject({ id: residente.id, correo: residente.correo, rol: 'residente' });

    const payload = jwt.verify(resultado.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({
      id: residente.id,
      correo: residente.correo,
      rol: 'residente',
      unidad_id: residente.unidad_id,
    });
  });

  it('incluye el rol admin en el token de un administrador', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ ...admin, password_hash: 'x' });
    vi.mocked(compararPassword).mockResolvedValue(true);

    const { token } = await login(admin.correo, 'Admin123');

    expect(jwt.verify(token, process.env.JWT_SECRET).rol).toBe('admin');
  });

  it('rechaza con "Credenciales inválidas" si el correo no existe', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);

    await expect(login('noexiste@condominio.com', 'x')).rejects.toThrow('Credenciales inválidas');
    expect(compararPassword).not.toHaveBeenCalled();
  });

  it('rechaza con "Credenciales inválidas" si la contraseña es incorrecta', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(usuarioConHash);
    vi.mocked(compararPassword).mockResolvedValue(false);

    await expect(login(residente.correo, 'incorrecta')).rejects.toThrow('Credenciales inválidas');
  });

  it('usa el mismo mensaje para correo inexistente y contraseña incorrecta (no revela cuál falló)', async () => {
    vi.mocked(findByCorreo).mockResolvedValueOnce(null);
    const errorCorreo = await login('x@x.com', 'x').catch((e) => e);

    vi.mocked(findByCorreo).mockResolvedValueOnce(usuarioConHash);
    vi.mocked(compararPassword).mockResolvedValueOnce(false);
    const errorPassword = await login(residente.correo, 'x').catch((e) => e);

    expect(errorCorreo.message).toBe(errorPassword.message);
  });

  it('rechaza a un usuario inactivo aunque la contraseña sea correcta', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ ...residenteInactivo, password_hash: 'x' });
    vi.mocked(compararPassword).mockResolvedValue(true);

    await expect(login(residenteInactivo.correo, 'Secreta123')).rejects.toThrow(
      'Usuario inactivo. Contacte al administrador.'
    );
  });

  it('no revela que el usuario está inactivo si la contraseña es incorrecta', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ ...residenteInactivo, password_hash: 'x' });
    vi.mocked(compararPassword).mockResolvedValue(false);

    await expect(login(residenteInactivo.correo, 'mala')).rejects.toThrow('Credenciales inválidas');
  });

  it('traduce un fallo de la BD a "No se pudo conectar con el servidor"', async () => {
    vi.mocked(findByCorreo).mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(login(residente.correo, 'x')).rejects.toThrow('No se pudo conectar con el servidor');
  });
});

describe('CU-01 Login - auth.service.validarCredenciales', () => {
  it('regresa el usuario si existe y está activo', async () => {
    vi.mocked(findById).mockResolvedValue(residente);
    await expect(validarCredenciales(residente.id)).resolves.toEqual(residente);
  });

  it('lanza "Usuario no encontrado" si el id no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);
    await expect(validarCredenciales(999)).rejects.toThrow('Usuario no encontrado');
  });

  it('lanza "Usuario inactivo" si el usuario fue dado de baja', async () => {
    vi.mocked(findById).mockResolvedValue(residenteInactivo);
    await expect(validarCredenciales(residenteInactivo.id)).rejects.toThrow('Usuario inactivo');
  });
});

// Helpers para probar middlewares de Express sin levantar el servidor
function crearRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('CU-01 Login - middleware requireAuth', () => {
  it('responde 401 si no se envía el header Authorization', async () => {
    const req = { headers: {} };
    const res = crearRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 si el header no usa el esquema Bearer', async () => {
    const req = { headers: { authorization: `Basic ${tokenPara(residente)}` } };
    const res = crearRes();

    await requireAuth(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responde 401 si el token es inválido', async () => {
    const req = { headers: { authorization: 'Bearer token.falso.123' } };
    const res = crearRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 si el token fue firmado con otro secreto', async () => {
    const tokenAjeno = jwt.sign({ id: admin.id, rol: 'admin' }, 'otro-secreto');
    const req = { headers: { authorization: `Bearer ${tokenAjeno}` } };
    const res = crearRes();

    await requireAuth(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' });
  });

  it('responde 401 si el token ya expiró', async () => {
    const expirado = tokenPara(residente, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expirado}` } };
    const res = crearRes();

    await requireAuth(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido o expirado' });
  });

  it('responde 401 si el usuario del token está inactivo (sesión revocada)', async () => {
    vi.mocked(findById).mockImplementation(findUsuarioPorId);
    const req = { headers: { authorization: `Bearer ${tokenPara(residenteInactivo)}` } };
    const res = crearRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario inactivo. Contacte al administrador.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 si el usuario del token ya no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${tokenPara(residente)}` } };
    const res = crearRes();

    await requireAuth(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  it('agrega req.user con los datos de la BD y llama a next() con un token válido', async () => {
    vi.mocked(findById).mockImplementation(findUsuarioPorId);
    const req = { headers: { authorization: `Bearer ${tokenPara(residente)}` } };
    const res = crearRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual({
      id: residente.id,
      correo: residente.correo,
      rol: residente.rol,
      unidad_id: residente.unidad_id,
    });
  });

  it('toma el rol de la BD y no del token (un rol alterado en el token no sirve)', async () => {
    // El token dice "admin" pero en la BD el usuario es residente
    const tokenConRolFalso = jwt.sign({ id: residente.id, rol: 'admin' }, process.env.JWT_SECRET);
    vi.mocked(findById).mockImplementation(findUsuarioPorId);
    const req = { headers: { authorization: `Bearer ${tokenConRolFalso}` } };

    await requireAuth(req, crearRes(), vi.fn());

    expect(req.user.rol).toBe('residente');
  });
});

describe('CU-01 Login - middleware requireAdmin', () => {
  it('llama a next() si el usuario es admin', () => {
    const next = vi.fn();
    requireAdmin({ user: { ...admin } }, crearRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('responde 403 si el usuario es residente', () => {
    const res = crearRes();
    const next = vi.fn();

    requireAdmin({ user: { ...residente } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 403 si no hay usuario autenticado', () => {
    const res = crearRes();
    requireAdmin({}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
