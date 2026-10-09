// CU-04: alta de residente (administrador).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({ crearResidente: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import AltaResidentePage from '../../src/pages/AltaResidentePage';
import { crearResidente } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

async function llenarFormulario(user, { correo = 'nuevo@condominio.com', unidad = '5' } = {}) {
  if (correo) await user.type(screen.getByLabelText('Correo electrónico'), correo);
  if (unidad) await user.type(screen.getByLabelText('Unidad'), unidad);
  await user.click(screen.getByRole('button', { name: 'Dar de alta' }));
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
});

describe('CU-04 AltaResidentePage', () => {
  it('da de alta al residente y muestra la contraseña temporal', async () => {
    vi.mocked(crearResidente).mockResolvedValue({
      success: true,
      residente: { correo: 'nuevo@condominio.com', unidad_id: 5 },
      passwordTemporal: 'Temp#12345ab',
    });
    const user = userEvent.setup();
    renderPagina(<AltaResidentePage />);

    await llenarFormulario(user);

    expect(crearResidente).toHaveBeenCalledWith('nuevo@condominio.com', 5);
    expect(await screen.findByText('Residente creado exitosamente')).toBeInTheDocument();
    expect(screen.getByText('Temp#12345ab')).toBeInTheDocument();
    expect(screen.getByText('nuevo@condominio.com')).toBeInTheDocument();
  });

  it('permite dar de alta a otro residente con el formulario limpio', async () => {
    vi.mocked(crearResidente).mockResolvedValue({
      success: true,
      residente: { correo: 'nuevo@condominio.com', unidad_id: 5 },
      passwordTemporal: 'Temp#12345ab',
    });
    const user = userEvent.setup();
    renderPagina(<AltaResidentePage />);
    await llenarFormulario(user);

    await user.click(await screen.findByRole('button', { name: 'Dar de alta otro residente' }));

    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('');
    expect(screen.getByLabelText('Unidad')).toHaveValue(null);
  });

  it('muestra el error del backend y conserva los datos capturados', async () => {
    vi.mocked(crearResidente).mockResolvedValue({ success: false, error: 'La unidad ya tiene un residente activo' });
    const user = userEvent.setup();
    renderPagina(<AltaResidentePage />);

    await llenarFormulario(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('La unidad ya tiene un residente activo');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('nuevo@condominio.com');
  });

  it('muestra un error genérico si la petición truena', async () => {
    vi.mocked(crearResidente).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPagina(<AltaResidentePage />);

    await llenarFormulario(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado al dar de alta al residente.');
  });

  it('valida que correo y unidad no estén vacíos (solo espacios)', async () => {
    const user = userEvent.setup();
    renderPagina(<AltaResidentePage />);
    const correo = screen.getByLabelText('Correo electrónico');
    correo.removeAttribute('required');
    correo.setAttribute('type', 'text');
    screen.getByLabelText('Unidad').removeAttribute('required');

    await user.type(correo, '   ');
    await user.click(screen.getByRole('button', { name: 'Dar de alta' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Correo y unidad son obligatorios.');
    expect(crearResidente).not.toHaveBeenCalled();
  });

  it('deshabilita el botón mientras guarda', async () => {
    let resolver;
    vi.mocked(crearResidente).mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();
    renderPagina(<AltaResidentePage />);

    await llenarFormulario(user);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    resolver({ success: false, error: 'x' });
    expect(await screen.findByRole('button', { name: 'Dar de alta' })).toBeEnabled();
  });
});
