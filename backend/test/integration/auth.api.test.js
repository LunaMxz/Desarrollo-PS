// CU-01: Login - pruebas de la API (ruta + controller + service).
// Solo se mockean el repositorio y bcrypt: no se necesita BD.
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import { findByCorreo } from '../../src/repositories/usuarios.repository.js';
import { compararPassword } from '../../src/utils/password.util.js';
import { residente, residenteInactivo } from '../helpers/fixtures.js';

describe('GET /health', () => {
  it('responde { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('CU-01 POST /auth/login', () => {
  it('200: regresa token y usuario sin password_hash', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ ...residente, password_hash: 'hash' });
    vi.mocked(compararPassword).mockResolvedValue(true);

    const res = await request(app)
      .post('/auth/login')
      .send({ correo: residente.correo, password: 'Secreta123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login exitoso');
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ id: residente.id, rol: 'residente' });
    expect(res.body.usuario).not.toHaveProperty('password_hash');
  });

  it.each([
    ['sin correo', { password: 'x' }],
    ['sin password', { correo: 'a@a.com' }],
    ['body vacío', {}],
  ])('400: %s', async (_caso, body) => {
    const res = await request(app).post('/auth/login').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Correo y contraseña son obligatorios');
    expect(findByCorreo).not.toHaveBeenCalled();
  });

  it('401: credenciales inválidas', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);

    const res = await request(app).post('/auth/login').send({ correo: 'x@x.com', password: 'x' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

  it('401: usuario inactivo', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ ...residenteInactivo, password_hash: 'hash' });
    vi.mocked(compararPassword).mockResolvedValue(true);

    const res = await request(app)
      .post('/auth/login')
      .send({ correo: residenteInactivo.correo, password: 'Secreta123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Usuario inactivo. Contacte al administrador.');
  });

  it('503: la BD no está disponible', async () => {
    vi.mocked(findByCorreo).mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).post('/auth/login').send({ correo: 'a@a.com', password: 'x' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('No se pudo conectar con el servidor');
  });
});
