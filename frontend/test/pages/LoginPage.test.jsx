// CU-01: inicio de sesión.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import LoginPage from '../../src/pages/LoginPage';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

const login = vi.fn();

function renderLogin() {
  return renderPagina(<LoginPage />, {
    ruta: '/login',
    rutasExtra: { '/admin/dashboard': 'Panel admin', '/residentes': 'Inicio residente', '/dashboard': 'Dashboard genérico' },
  });
}

async function ingresar(user, correo = 'admin@condominio.com', password = 'Secreta123') {
  await user.type(screen.getByLabelText('Correo electrónico'), correo);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

beforeEach(() => {
  login.mockReset();
  vi.mocked(useAuth).mockReturnValue({ login });
});

describe('CU-01 LoginPage', () => {
  it.each([
    ['admin', 'Panel admin'],
    ['residente', 'Inicio residente'],
    ['otro', 'Dashboard genérico'],
  ])('redirige según el rol (%s)', async (rol, destino) => {
    login.mockResolvedValue({ success: true, user: { rol } });
    const user = userEvent.setup();
    renderLogin();

    await ingresar(user);

    expect(await screen.findByText(destino)).toBeInTheDocument();
  });

  it('quita espacios del correo pero no de la contraseña', async () => {
    login.mockResolvedValue({ success: true, user: { rol: 'admin' } });
    const user = userEvent.setup();
    renderLogin();

    await ingresar(user, '  admin@condominio.com  ', ' clave ');

    expect(login).toHaveBeenCalledWith('admin@condominio.com', ' clave ');
  });

  it('muestra el error de credenciales', async () => {
    login.mockResolvedValue({ success: false, error: 'Correo o contraseña incorrectos.' });
    const user = userEvent.setup();
    renderLogin();

    await ingresar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it.each([
    [Object.assign(new Error('timeout of 8000ms exceeded'), { code: 'ECONNABORTED' }), 'El servidor tardó demasiado en responder. Intente más tarde.'],
    [new Error('boom'), 'Ocurrió un error inesperado al intentar iniciar sesión.'],
  ])('maneja errores inesperados (%#)', async (error, mensaje) => {
    login.mockRejectedValue(error);
    const user = userEvent.setup();
    renderLogin();

    await ingresar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('muestra y oculta la contraseña', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Contraseña');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('deshabilita el formulario mientras ingresa', async () => {
    let resolver;
    login.mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();
    renderLogin();

    await ingresar(user);

    expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled();
    resolver({ success: false, error: 'x' });
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });
});
