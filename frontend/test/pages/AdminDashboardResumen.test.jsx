import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardResumen from '../../src/components/DashboardResumen';
import { obtenerBalance, listarGastos } from '../../src/api/transparencia.api';
import { obtenerMorosidad, listarIncidenciasPendientes } from '../../src/api/client';
import { listarComunicados } from '../../src/api/comunicados.api';

vi.mock('../../src/api/transparencia.api', () => ({ obtenerBalance: vi.fn(), listarGastos: vi.fn() }));
vi.mock('../../src/api/client', () => ({ obtenerMorosidad: vi.fn(), listarIncidenciasPendientes: vi.fn() }));
vi.mock('../../src/api/comunicados.api', () => ({ listarComunicados: vi.fn() }));

beforeEach(() => {
  obtenerBalance.mockResolvedValue({ success: true, balance: { ingresos: 1000, egresos: 2000, saldo_mes: -1000, saldo_acumulado: 500 } });
  obtenerMorosidad.mockResolvedValue({ success: true, unidades: [{ adeudo: 1500 }] });
  listarIncidenciasPendientes.mockResolvedValue({ success: true, incidencias: [{ responsable: null }] });
  listarComunicados.mockResolvedValue({ success: true, comunicados: [{ id: 1, titulo: 'Aviso de mantenimiento', fecha_publicacion: '2026-11-01T12:00:00' }] });
  listarGastos.mockResolvedValue({ success: true, publicaciones: [] });
});

describe('Resumen administrativo', () => {
  it('presenta datos, déficit, pendientes y publicaciones', async () => {
    render(<MemoryRouter><DashboardResumen /></MemoryRouter>);
    expect(await screen.findByText('Déficit de $1,000.00')).toBeInTheDocument();
    expect(await screen.findByText('1 sin responsable asignado')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00 por cobrar actualmente')).toBeInTheDocument();
    expect(screen.getByText('Aviso de mantenimiento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver balance completo/ })).toHaveAttribute('href', '/admin/transparencia/balance');
  });

  it('una falla de balance no bloquea publicaciones y permite reintentar', async () => {
    obtenerBalance.mockResolvedValueOnce({ success: false });
    render(<MemoryRouter><DashboardResumen /></MemoryRouter>);
    expect(await screen.findByText('No se pudo cargar balance.')).toBeInTheDocument();
    expect(await screen.findByText('Aviso de mantenimiento')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar balance' }));
    expect(await screen.findByText('Déficit de $1,000.00')).toBeInTheDocument();
    expect(listarComunicados).toHaveBeenCalledTimes(1);
  });

  it('no afirma que no hay pendientes cuando falla morosidad', async () => {
    obtenerMorosidad.mockResolvedValue({ success: false });
    listarIncidenciasPendientes.mockResolvedValue({ success: true, incidencias: [] });
    render(<MemoryRouter><DashboardResumen /></MemoryRouter>);
    expect(await screen.findByText('No se pudo cargar morosidad.')).toBeInTheDocument();
    expect(screen.queryByText('Sin incidencias pendientes ni unidades con adeudo.')).not.toBeInTheDocument();
  });
});
