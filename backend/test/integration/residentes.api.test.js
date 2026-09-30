// CU-04 (alta) y CU-05 (baja) de residentes - pruebas de la API.
// Solo se mockean el repositorio y bcrypt: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import {
  findById,
  findByCorreo,
  verificarUnidadTieneResidenteActivo,
  crearUsuario,
  desactivarUsuario,
} from '../../src/repositories/usuarios.repository.js';
import { hashPassword } from '../../src/utils/password.util.js';
import { admin, residente, findUsuarioPorId, bearer, tokenPara } from '../helpers/fixtures.js';

beforeEach(() => {
  // requireAuth revalida al usuario del token contra la "BD" en cada request
  vi.mocked(findById).mockImplementation(findUsuarioPorId);
});

describe('CU-04 POST /residentes', () => {
  const datosAlta = { correo: 'nuevo@condominio.com', password: 'Secreta123', unidad_id: 20 };

  it('201: el admin da de alta a un residente', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(false);
    vi.mocked(hashPassword).mockResolvedValue('hash');
    vi.mocked(crearUsuario).mockResolvedValue({ id: 50, correo: datosAlta.correo, rol: 'residente', unidad_id: 20, activo: true });

    const res = await request(app).post('/residentes').set('Authorization', bearer(admin)).send(datosAlta);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Residente creado exitosamente');
    expect(res.body.residente).toMatchObject({ correo: datosAlta.correo, rol: 'residente', activo: true });
    expect(res.body.residente).not.toHaveProperty('password_hash');
  });

  it('401: sin token', async () => {
    const res = await request(app).post('/residentes').send(datosAlta);
    expect(res.status).toBe(401);
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it('403: un residente no puede dar de alta residentes', async () => {
    const res = await request(app).post('/residentes').set('Authorization', bearer(residente)).send(datosAlta);
    expect(res.status).toBe(403);
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it.each(['correo', 'password', 'unidad_id'])('400: falta el campo %s', async (campo) => {
    const body = { ...datosAlta };
    delete body[campo];

    const res = await request(app).post('/residentes').set('Authorization', bearer(admin)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Correo, password y unidad_id son obligatorios');
  });

  it('400: el correo ya está registrado', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ id: 9, correo: datosAlta.correo });

    const res = await request(app).post('/residentes').set('Authorization', bearer(admin)).send(datosAlta);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El correo ya está registrado');
  });

  it('400: la unidad ya tiene un residente activo', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(true);

    const res = await request(app).post('/residentes').set('Authorization', bearer(admin)).send(datosAlta);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La unidad ya tiene un residente activo');
  });
});

describe('CU-05 PATCH /residentes/:id/baja', () => {
  it('200: el admin da de baja a un residente y recibe el aviso de saldo', async () => {
    vi.mocked(desactivarUsuario).mockResolvedValue({ ...residente, activo: false });

    const res = await request(app).patch(`/residentes/${residente.id}/baja`).set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Residente dado de baja exitosamente');
    expect(res.body.residente.activo).toBe(false);
    expect(res.body.aviso).toMatch(/saldo pendiente/i);
  });

  it('401: sin token', async () => {
    const res = await request(app).patch(`/residentes/${residente.id}/baja`);
    expect(res.status).toBe(401);
  });

  it('403: un residente no puede dar de baja a otro', async () => {
    const res = await request(app).patch('/residentes/3/baja').set('Authorization', bearer(residente));
    expect(res.status).toBe(403);
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });

  it('404: el residente no existe', async () => {
    const res = await request(app).patch('/residentes/999/baja').set('Authorization', bearer(admin));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Usuario no encontrado');
  });

  it('400: no se puede dar de baja a un administrador', async () => {
    const res = await request(app).patch(`/residentes/${admin.id}/baja`).set('Authorization', bearer(admin));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No se puede desactivar a un administrador');
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });

  it('revoca la sesión: el token del residente deja de funcionar tras la baja', async () => {
    const tokenResidente = tokenPara(residente);
    let activo = true;
    vi.mocked(findById).mockImplementation(async (id) => {
      if (Number(id) === residente.id) return { ...residente, activo };
      return findUsuarioPorId(id);
    });
    vi.mocked(desactivarUsuario).mockImplementation(async () => {
      activo = false;
      return { ...residente, activo: false };
    });

    // Antes de la baja el token sirve: pasa requireAuth y falla después por el body vacío (400)
    const antes = await request(app).post('/incidencias').set('Authorization', `Bearer ${tokenResidente}`).send({});
    expect(antes.status).toBe(400);

    await request(app).patch(`/residentes/${residente.id}/baja`).set('Authorization', bearer(admin)).expect(200);

    // Después de la baja, el mismo token (aún no expirado) es rechazado
    const despues = await request(app).post('/incidencias').set('Authorization', `Bearer ${tokenResidente}`).send({});
    expect(despues.status).toBe(401);
    expect(despues.body.error).toBe('Usuario inactivo. Contacte al administrador.');
  });
});
