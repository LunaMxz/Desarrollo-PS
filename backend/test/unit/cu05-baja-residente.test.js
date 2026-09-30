// CU-05: Baja de residente (soft delete: activo = false)
// Pruebas unitarias de residentes.service.darDeBaja (-> auth.service.desactivarResidente).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/repositories/usuarios.repository.js');
vi.mock('../../src/utils/password.util.js');

import { darDeBaja } from '../../src/services/residentes.service.js';
import { findById, desactivarUsuario } from '../../src/repositories/usuarios.repository.js';
import { admin, residente } from '../helpers/fixtures.js';

describe('CU-05 Baja de residente - residentes.service.darDeBaja', () => {
  it('desactiva al residente y regresa el aviso de saldo pendiente', async () => {
    vi.mocked(findById).mockResolvedValue(residente);
    vi.mocked(desactivarUsuario).mockResolvedValue({ ...residente, activo: false });

    const resultado = await darDeBaja(residente.id, admin.id);

    expect(desactivarUsuario).toHaveBeenCalledWith(residente.id);
    expect(resultado.residente.activo).toBe(false);
    expect(resultado.avisoSaldoPendiente).toMatch(/saldo pendiente/i);
  });

  it('es un soft delete: solo desactiva, no elimina el registro', async () => {
    vi.mocked(findById).mockResolvedValue(residente);
    vi.mocked(desactivarUsuario).mockResolvedValue({ ...residente, activo: false });

    const { residente: resultado } = await darDeBaja(residente.id, admin.id);

    expect(resultado).toMatchObject({ id: residente.id, correo: residente.correo, activo: false });
  });

  it('lanza "Usuario no encontrado" si el residente no existe', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    await expect(darDeBaja(999, admin.id)).rejects.toThrow('Usuario no encontrado');
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });

  it('no permite dar de baja a un administrador', async () => {
    const otroAdmin = { ...admin, id: 5 };
    vi.mocked(findById).mockResolvedValue(otroAdmin);

    await expect(darDeBaja(otroAdmin.id, admin.id)).rejects.toThrow(
      'No se puede desactivar a un administrador'
    );
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });

  it('no permite que el admin se dé de baja a sí mismo', async () => {
    vi.mocked(findById).mockResolvedValue(admin);

    await expect(darDeBaja(admin.id, admin.id)).rejects.toThrow();
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });

  it('no permite que un usuario se desactive a sí mismo', async () => {
    vi.mocked(findById).mockResolvedValue(residente);

    await expect(darDeBaja(residente.id, residente.id)).rejects.toThrow(
      'No puedes desactivarte a ti mismo'
    );
    expect(desactivarUsuario).not.toHaveBeenCalled();
  });
});
