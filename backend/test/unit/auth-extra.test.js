// Partes de autenticación que no cubren las pruebas de CU-01/CU-04:
// password.util (bcrypt real), controller registrarUsuario y funciones auxiliares de auth.service.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/repositories/usuarios.repository.js');

import { hashPassword, compararPassword } from '../../src/utils/password.util.js';
import { registrarUsuario } from '../../src/controllers/auth.controller.js';
import { verificarUsuarioActivo, validarCredenciales } from '../../src/services/auth.service.js';
import {
  findByCorreo,
  findById,
  isActive,
  verificarUnidadTieneResidenteActivo,
  crearUsuario,
} from '../../src/repositories/usuarios.repository.js';
import { admin, residente, residenteInactivo } from '../helpers/fixtures.js';

function crearRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('password.util', () => {
  it('hashPassword no guarda el texto plano y compararPassword lo valida', async () => {
    const hash = await hashPassword('Secreta123');

    expect(hash).not.toBe('Secreta123');
    expect(await compararPassword('Secreta123', hash)).toBe(true);
    expect(await compararPassword('otra', hash)).toBe(false);
  });
});

describe('auth.controller.registrarUsuario', () => {
  const body = { correo: 'nuevo@condominio.com', password: 'Secreta123', unidad_id: 20 };

  beforeEach(() => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(false);
    vi.mocked(crearUsuario).mockImplementation(async ({ correo, rol, unidadId }) => ({ id: 30, correo, rol, unidad_id: unidadId }));
  });

  it('201: un admin crea un residente (con contraseña hasheada)', async () => {
    const res = crearRes();
    const next = vi.fn();

    await registrarUsuario({ user: admin, body }, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Usuario creado exitosamente',
      usuario: { id: 30, correo: body.correo, rol: 'residente', unidad_id: 20 },
    });
    const { passwordHash } = vi.mocked(crearUsuario).mock.calls[0][0];
    expect(passwordHash).not.toBe(body.password);
    expect(next).not.toHaveBeenCalled();
  });

  it('403: solo un admin puede crear usuarios', async () => {
    const next = vi.fn();

    await registrarUsuario({ user: residente, body }, crearRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('400: faltan datos', async () => {
    const next = vi.fn();

    await registrarUsuario({ user: admin, body: { correo: body.correo } }, crearRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, message: 'Correo, password y unidad_id son obligatorios' }));
  });

  it('400: el correo ya existe', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ id: 1 });
    const next = vi.fn();

    await registrarUsuario({ user: admin, body }, crearRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, message: 'El correo ya está registrado' }));
  });

  it('400: la unidad ya tiene residente activo', async () => {
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(true);
    const next = vi.fn();

    await registrarUsuario({ user: admin, body }, crearRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, message: 'La unidad ya tiene un residente activo' }));
  });
});

describe('auth.service auxiliares', () => {
  it('verificarUsuarioActivo delega en el repositorio', async () => {
    vi.mocked(isActive).mockResolvedValue(true);

    expect(await verificarUsuarioActivo(2)).toBe(true);
    expect(isActive).toHaveBeenCalledWith(2);
  });

  it('validarCredenciales regresa al usuario activo', async () => {
    vi.mocked(findById).mockResolvedValue(residente);

    expect(await validarCredenciales(residente.id)).toEqual(residente);
  });

  it('validarCredenciales rechaza usuarios inexistentes o inactivos', async () => {
    vi.mocked(findById).mockResolvedValue(null);
    await expect(validarCredenciales(999)).rejects.toThrow('Usuario no encontrado');

    vi.mocked(findById).mockResolvedValue(residenteInactivo);
    await expect(validarCredenciales(residenteInactivo.id)).rejects.toThrow('Usuario inactivo');
  });
});
