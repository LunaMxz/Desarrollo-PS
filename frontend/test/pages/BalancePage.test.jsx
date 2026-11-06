import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPagina } from '../helpers/render';
import BalancePage from '../../src/pages/BalancePage';
import ComunicadosPage from '../../src/pages/ComunicadosPage';
import App from '../../src/App';
import { AuthProvider } from '../../src/context/AuthContext';
import { obtenerBalance, listarGastos } from '../../src/api/transparencia.api';
import { listarComunicados } from '../../src/api/comunicados.api';
import { obtenerBalancePrueba } from '../../src/mocks/balance';

vi.mock('../../src/api/transparencia.api', () => ({ obtenerBalance: vi.fn(), listarGastos: vi.fn(), publicarGasto: vi.fn() }));
vi.mock('../../src/api/comunicados.api', () => ({ listarComunicados: vi.fn(), publicarComunicado: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  obtenerBalance.mockResolvedValue({ success: true, balance: obtenerBalancePrueba(2026, 10) });
  listarComunicados.mockResolvedValue({ success: true, comunicados: [] });
  listarGastos.mockResolvedValue({ success: true, publicaciones: [], pagina: 1, totalPaginas: 0 });
});

describe('Balance financiero', () => {
  it('muestra carga, cuatro tarjetas, categorías proporcionales y por cobrar para admin', async () => {
    let resolver;
    obtenerBalance.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    const { container } = renderPagina(<AuthProvider><BalancePage /></AuthProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando balance');
    resolver({ success: true, balance: obtenerBalancePrueba(2026, 10) });
    await screen.findByText('Ingresos');
    expect(screen.getAllByRole('term')).toHaveLength(4);
    expect(screen.getByText('$12,000.00')).toBeInTheDocument();
    expect(screen.getByText('Por cobrar actualmente:', { exact: false })).toHaveTextContent('$3,500.00');
    expect(container.querySelector('.resumen-balance__barra')).toHaveStyle({ width: '75%' });
  });

  it('consulta el mes seleccionado y expresa ambos déficits con texto', async () => {
    renderPagina(<AuthProvider><BalancePage /></AuthProvider>);
    await screen.findByText('Ingresos');
    fireEvent.change(screen.getByLabelText('Mes del balance'), { target: { value: '2026-10' } });
    await screen.findByText('Ingresos');
    obtenerBalance.mockResolvedValueOnce({ success: true, balance: obtenerBalancePrueba(2026, 11) });
    fireEvent.change(screen.getByLabelText('Mes del balance'), { target: { value: '2026-11' } });
    expect(await screen.findByText('Déficit de $5,000.00')).toBeInTheDocument();
    expect(screen.getByText('Déficit de $1,000.00')).toBeInTheDocument();
    expect(obtenerBalance).toHaveBeenLastCalledWith(2026, 11);
  });

  it('muestra el mes vacío sin ocultar el saldo acumulado', async () => {
    obtenerBalance.mockResolvedValue({ success: true, balance: obtenerBalancePrueba(2026, 12) });
    renderPagina(<AuthProvider><BalancePage /></AuthProvider>);
    expect(await screen.findByText('Sin movimientos este mes')).toBeInTheDocument();
    expect(screen.getByText('Déficit de $1,000.00')).toBeInTheDocument();
  });

  it('permite reintentar tras un error', async () => {
    obtenerBalance.mockResolvedValueOnce({ success: false, error: 'Sin conexión' });
    renderPagina(<AuthProvider><BalancePage /></AuthProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ingresos')).toBeInTheDocument();
  });

  it('carga el resumen del residente encima de gastos y oculta por cobrar', async () => {
    renderPagina(<AuthProvider><ComunicadosPage /></AuthProvider>);
    await screen.findByText('No hay comunicados por el momento');
    expect(obtenerBalance).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: 'Transparencia' }));
    const panel = screen.getByRole('tabpanel', { name: 'Transparencia' });
    expect(await within(panel).findByText('Ingresos')).toBeInTheDocument();
    expect(within(panel).queryByText(/Por cobrar actualmente/)).not.toBeInTheDocument();
    expect(panel.querySelector('.resumen-balance').nextElementSibling).toHaveClass('lista-gastos');
  });

  it('el admin puede acceder desde la tarjeta del dashboard', async () => {
    localStorage.setItem('token', 'prueba');
    localStorage.setItem('user', JSON.stringify({ rol: 'admin' }));
    window.history.pushState({}, '', '/admin/dashboard');
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: /Balance financiero/ }));
    expect(window.location.pathname).toBe('/admin/transparencia/balance');
    expect(await screen.findByText('Ingresos')).toBeInTheDocument();
  });

  it('un residente no puede acceder a la ruta administrativa', async () => {
    localStorage.setItem('token', 'prueba');
    localStorage.setItem('user', JSON.stringify({ rol: 'residente' }));
    window.history.pushState({}, '', '/admin/transparencia/balance');
    render(<App />);
    expect(await screen.findByText('No tienes permiso para ver esta página')).toBeInTheDocument();
    expect(obtenerBalance).not.toHaveBeenCalled();
  });
});
