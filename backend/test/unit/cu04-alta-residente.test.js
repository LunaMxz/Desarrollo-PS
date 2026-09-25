// CU-04: Alta de residente
// Pruebas unitarias de residentes.service.crearResidente (-> auth.service.registrar).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/utils/password.util.js');

import { crearResidente } from '../../src/services/residentes.service.js';
import {
  findByCorreo,
  verificarUnidadTieneResidenteActivo,
  crearUsuario,
} from '../../src/repositories/usuarios.repository.js';
import { hashPassword } from '../../src/utils/password.util.js';

const datosAlta = { correo: 'nuevo@condominio.com', password: 'Secreta123', unidad_id: 20 };

const residenteCreado = {
  id: 50,
  correo: datosAlta.correo,
  rol: 'residente',
  unidad_id: datosAlta.unidad_id,
  activo: true,
  fecha_creacion: '2026-09-25T00:00:00.000Z',
};

describe('CU-04 Alta de residente - residentes.service.crearResidente', () => {
  it('crea al residente con la contraseña hasheada y rol "residente"', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(false);
    vi.mocked(hashPassword).mockResolvedValue('$2b$10$hashGenerado');
    vi.mocked(crearUsuario).mockResolvedValue(residenteCreado);

    const resultado = await crearResidente(datosAlta);

    expect(hashPassword).toHaveBeenCalledWith(datosAlta.password);
    expect(crearUsuario).toHaveBeenCalledWith({
      correo: datosAlta.correo,
      passwordHash: '$2b$10$hashGenerado',
      rol: 'residente',
      unidadId: datosAlta.unidad_id,
    });
    expect(resultado).toEqual(residenteCreado);
  });

  it('nunca guarda la contraseña en texto plano', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(false);
    vi.mocked(hashPassword).mockResolvedValue('hash');
    vi.mocked(crearUsuario).mockResolvedValue(residenteCreado);

    await crearResidente(datosAlta);

    const argumentos = vi.mocked(crearUsuario).mock.calls[0][0];
    expect(Object.values(argumentos)).not.toContain(datosAlta.password);
  });

  it('siempre asigna rol "residente" aunque se intente enviar otro rol', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(false);
    vi.mocked(hashPassword).mockResolvedValue('hash');
    vi.mocked(crearUsuario).mockResolvedValue(residenteCreado);

    await crearResidente({ ...datosAlta, rol: 'admin' });

    expect(vi.mocked(crearUsuario).mock.calls[0][0].rol).toBe('residente');
  });

  it('rechaza el alta si el correo ya está registrado', async () => {
    vi.mocked(findByCorreo).mockResolvedValue({ id: 7, correo: datosAlta.correo });

    await expect(crearResidente(datosAlta)).rejects.toThrow('El correo ya está registrado');
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it('rechaza el alta si la unidad ya tiene un residente activo', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(true);

    await expect(crearResidente(datosAlta)).rejects.toThrow('La unidad ya tiene un residente activo');
    expect(verificarUnidadTieneResidenteActivo).toHaveBeenCalledWith(datosAlta.unidad_id);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(crearUsuario).not.toHaveBeenCalled();
  });

  it('propaga errores inesperados del repositorio', async () => {
    vi.mocked(findByCorreo).mockResolvedValue(null);
    vi.mocked(verificarUnidadTieneResidenteActivo).mockResolvedValue(false);
    vi.mocked(hashPassword).mockResolvedValue('hash');
    vi.mocked(crearUsuario).mockRejectedValue(new Error('fallo de BD'));

    await expect(crearResidente(datosAlta)).rejects.toThrow('fallo de BD');
  });
});
