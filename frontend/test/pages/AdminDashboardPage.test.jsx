// Panel del administrador y encabezado compartido (AdminHeader).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import AdminDashboardPage from '../../src/pages/AdminDashboardPage';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

const logout = vi.fn();

beforeEach(() => {
  logout.mockReset();
  vi.mocked(useAuth).mockReturnValue({ logout });
});

describe('AdminDashboardPage', () => {
  it.each([
    ['Alta de residente', '/admin/residentes/alta'],
    ['Baja de residente', '/admin/residentes/baja'],
    ['Gestión de incidencias', '/admin/incidencias'],
    ['Generar cargos del mes', '/admin/cargos/generar'],
    ['Registrar pago', '/admin/pagos/registrar'],
  ])('tiene acceso a "%s"', (titulo, ruta) => {
    renderPagina(<AdminDashboardPage />);

    expect(screen.getByRole('link', { name: new RegExp(titulo) })).toHaveAttribute('href', ruta);
  });

  it('muestra comunicados como próximamente (sin enlace)', () => {
    renderPagina(<AdminDashboardPage />);

    expect(screen.getByText('Próximamente')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Comunicados/ })).not.toBeInTheDocument();
  });

  it('el dashboard no muestra el enlace de volver', () => {
    renderPagina(<AdminDashboardPage />);

    expect(screen.queryByRole('link', { name: /Volver/ })).not.toBeInTheDocument();
  });

  it('cerrar sesión limpia la sesión y manda al login', async () => {
    const user = userEvent.setup();
    renderPagina(<AdminDashboardPage />, { ruta: '/admin/dashboard', rutasExtra: { '/login': 'Pantalla de login' } });

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(logout).toHaveBeenCalled();
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
  });
});
