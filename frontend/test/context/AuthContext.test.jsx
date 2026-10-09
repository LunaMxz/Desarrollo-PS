// AuthContext: rehidratación de la sesión, login y logout.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({ login: vi.fn(), logout: vi.fn() }));

import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { login as loginService, logout as logoutService } from '../../src/api/client';

function Sonda() {
  const { user, cargando, login, logout } = useAuth();
  return (
    <div>
      <p>{cargando ? 'cargando' : 'listo'}</p>
      <p>usuario: {user ? user.correo : 'ninguno'}</p>
      <button onClick={() => login('a@a.com', 'x')}>entrar</button>
      <button onClick={logout}>salir</button>
    </div>
  );
}

function renderSonda() {
  return render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('AuthContext', () => {
  it('sin sesión guardada no hay usuario', async () => {
    renderSonda();

    expect(await screen.findByText('listo')).toBeInTheDocument();
    expect(screen.getByText('usuario: ninguno')).toBeInTheDocument();
  });

  it('rehidrata la sesión guardada al recargar', async () => {
    localStorage.setItem('token', 't1');
    localStorage.setItem('user', JSON.stringify({ correo: 'ana@condominio.com' }));

    renderSonda();

    expect(await screen.findByText('usuario: ana@condominio.com')).toBeInTheDocument();
  });

  it('descarta un usuario guardado corrupto', async () => {
    localStorage.setItem('token', 't1');
    localStorage.setItem('user', '{no-es-json');

    renderSonda();

    expect(await screen.findByText('usuario: ninguno')).toBeInTheDocument();
    expect(logoutService).toHaveBeenCalled();
  });

  it('descarta un token sin usuario', async () => {
    localStorage.setItem('token', 't1');

    renderSonda();

    await screen.findByText('listo');
    expect(logoutService).toHaveBeenCalled();
  });

  it('login exitoso guarda el usuario en el contexto', async () => {
    vi.mocked(loginService).mockResolvedValue({ success: true, user: { correo: 'a@a.com' } });
    const user = userEvent.setup();
    renderSonda();

    await user.click(screen.getByRole('button', { name: 'entrar' }));

    expect(await screen.findByText('usuario: a@a.com')).toBeInTheDocument();
  });

  it('login fallido no cambia el usuario', async () => {
    vi.mocked(loginService).mockResolvedValue({ success: false, error: 'x' });
    const user = userEvent.setup();
    renderSonda();

    await user.click(screen.getByRole('button', { name: 'entrar' }));

    expect(screen.getByText('usuario: ninguno')).toBeInTheDocument();
  });

  it('logout limpia el usuario', async () => {
    localStorage.setItem('token', 't1');
    localStorage.setItem('user', JSON.stringify({ correo: 'ana@condominio.com' }));
    const user = userEvent.setup();
    renderSonda();
    await screen.findByText('usuario: ana@condominio.com');

    await user.click(screen.getByRole('button', { name: 'salir' }));

    expect(screen.getByText('usuario: ninguno')).toBeInTheDocument();
    expect(logoutService).toHaveBeenCalled();
  });
});
