// Gestión de residentes (listado, detalle, desactivar y cambio de rol) - pruebas de la API.
// Solo se mockean el repositorio y bcrypt: no se necesita BD.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/utils/password.util.js');

import app from '../../src/app.js';
import {
  findById,
  obtenerResidentes,
  obtenerResidenteConUnidad,
  desactivarUsuario,
  actualizarRol,
} from '../../src/repositories/usuarios.repository.js';
import { admin, residente, findUsuarioPorId, bearer } from '../helpers/fixtures.js';

const residenteConUnidad = { ...residente, unidad_identificador: 'A-101' };

beforeEach(() => {
  vi.mocked(findById).mockImplementation(findUsuarioPorId);
});

describe('GET /residentes', () => {
  it('200: lista solo activos por defecto', async () => {
    vi.mocked(obtenerResidentes).mockResolvedValue([residenteConUnidad]);

    const res = await request(app).get('/residentes').set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.residentes).toEqual([residenteConUnidad]);
    expect(obtenerResidentes).toHaveBeenCalledWith({ soloActivos: true });
  });

  it('200: soloActivos=false incluye a los dados de baja', async () => {
    vi.mocked(obtenerResidentes).mockResolvedValue([]);

    await request(app).get('/residentes?soloActivos=false').set('Authorization', bearer(admin));

    expect(obtenerResidentes).toHaveBeenCalledWith({ soloActivos: false });
  });

  it('500: error inesperado de la BD', async () => {
    vi.mocked(obtenerResidentes).mockRejectedValue(new Error('Conexión perdida'));

    const res = await request(app).get('/residentes').set('Authorization', bearer(admin));

    expect(res.status).toBe(500);
  });
});

describe('GET /residentes/:id', () => {
  it('200: regresa el detalle con su unidad', async () => {
    vi.mocked(obtenerResidenteConUnidad).mockResolvedValue(residenteConUnidad);

    const res = await request(app).get(`/residentes/${residente.id}`).set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.residente).toEqual(residenteConUnidad);
  });

  it('404: el residente no existe', async () => {
    vi.mocked(obtenerResidenteConUnidad).mockResolvedValue(null);

    const res = await request(app).get('/residentes/999').set('Authorization', bearer(admin));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Residente no encontrado');
  });
});

describe('PATCH /residentes/:id/desactivar', () => {
  it('200: desactiva al residente', async () => {
    vi.mocked(desactivarUsuario).mockResolvedValue({ ...residente, activo: false });

    const res = await request(app).patch(`/residentes/${residente.id}/desactivar`).set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Residente desactivado exitosamente');
    expect(res.body.residente.activo).toBe(false);
  });

  it('400: el usuario no existe', async () => {
    const res = await request(app).patch('/residentes/999/desactivar').set('Authorization', bearer(admin));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Usuario no encontrado');
  });

  it('400: no se puede desactivar a un administrador', async () => {
    const res = await request(app).patch(`/residentes/${admin.id}/desactivar`).set('Authorization', bearer(admin));

    expect(res.status).toBe(400);
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });
});

describe('PATCH /residentes/:id/rol', () => {
  it('200: cambia el rol', async () => {
    vi.mocked(actualizarRol).mockResolvedValue({ ...residente, rol: 'admin' });

    const res = await request(app)
      .patch(`/residentes/${residente.id}/rol`)
      .set('Authorization', bearer(admin))
      .send({ rol: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.residente.rol).toBe('admin');
    expect(actualizarRol).toHaveBeenCalledWith(String(residente.id), 'admin');
  });

  it('400: falta el rol', async () => {
    const res = await request(app).patch(`/residentes/${residente.id}/rol`).set('Authorization', bearer(admin)).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El campo rol es obligatorio');
  });

  it('400: rol inválido', async () => {
    const res = await request(app)
      .patch(`/residentes/${residente.id}/rol`)
      .set('Authorization', bearer(admin))
      .send({ rol: 'superusuario' });

    expect(res.status).toBe(400);
    expect(actualizarRol).not.toHaveBeenCalled();
  });

  it('400: el usuario no existe', async () => {
    const res = await request(app).patch('/residentes/999/rol').set('Authorization', bearer(admin)).send({ rol: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Usuario no encontrado');
  });

  it('400: un admin no puede modificar a otro admin', async () => {
    const otroAdmin = { id: 50, correo: 'otro@condominio.com', rol: 'admin', unidad_id: null, activo: true };
    vi.mocked(findById).mockImplementation(async (id) => (Number(id) === otroAdmin.id ? otroAdmin : findUsuarioPorId(id)));

    const res = await request(app).patch(`/residentes/${otroAdmin.id}/rol`).set('Authorization', bearer(admin)).send({ rol: 'residente' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No tienes permiso para modificar a otro administrador');
  });

  it('403: un residente no puede cambiar roles', async () => {
    const res = await request(app).patch(`/residentes/${residente.id}/rol`).set('Authorization', bearer(residente)).send({ rol: 'admin' });

    expect(res.status).toBe(403);
  });
});
