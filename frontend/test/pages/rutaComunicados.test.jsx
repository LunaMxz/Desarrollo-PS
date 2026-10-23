// CU-11 / CU-12: acceso a Comunicados (avisos + transparencia) usando el App real
// (AuthProvider + rutas protegidas). Solo se mockean las llamadas a la API.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/comunicados.api', () => ({ listarComunicados: vi.fn(), publicarComunicado: vi.fn() }));
vi.mock('../../src/api/transparencia.api', () => ({ listarGastos: vi.fn(), publicarGasto: vi.fn() }));

import App from '../../src/App';
import { listarComunicados } from '../../src/api/comunicados.api';
import { listarGastos } from '../../src/api/transparencia.api';

function iniciarSesionComo(usuario, ruta) {
  localStorage.setItem('token', 'token-de-prueba');
  localStorage.setItem('user', JSON.stringify(usuario));
  window.history.pushState({}, '', ruta);
}

const admin = { id: 1, correo: 'admin@condominio.com', rol: 'admin' };
const residente = { id: 2, correo: 'residente@condominio.com', rol: 'residente' };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listarComunicados).mockResolvedValue({ success: true, comunicados: [] });
  vi.mocked(listarGastos).mockResolvedValue({ success: true, publicaciones: [], pagina: 1, totalPaginas: 0 });
});

describe('Ruta /admin/comunicados (historial del administrador)', () => {
  it('el admin llega desde el dashboard y ve las dos pestañas', async () => {
    iniciarSesionComo(admin, '/admin/dashboard');
    const user = userEvent.setup({ delay: null });

    render(<App />);
    await user.click(await screen.findByRole('link', { name: /Historial de comunicados/ }));

    expect(window.location.pathname).toBe('/admin/comunicados');
    expect(await screen.findByText('No hay comunicados por el momento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver al dashboard/ })).toHaveAttribute('href', '/admin/dashboard');

    await user.click(screen.getByRole('tab', { name: 'Transparencia' }));
    expect(await screen.findByText('Aún no hay gastos publicados')).toBeInTheDocument();
  });

  it('un residente no puede abrir el historial del admin', async () => {
    iniciarSesionComo(residente, '/admin/comunicados');

    render(<App />);

    expect(await screen.findByText('No tienes permiso para ver esta página')).toBeInTheDocument();
    expect(listarComunicados).not.toHaveBeenCalled();
  });
});

describe('Ruta /residentes/comunicados', () => {
  it('el residente la sigue viendo con su encabezado y regreso a su inicio', async () => {
    iniciarSesionComo(residente, '/residentes/comunicados');

    render(<App />);

    expect(await screen.findByText('No hay comunicados por el momento')).toBeInTheDocument();
    expect(screen.getByText('Portal de residentes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver al inicio/ })).toHaveAttribute('href', '/residentes');
  });
});
