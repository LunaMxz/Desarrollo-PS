import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderPagina } from '../helpers/render';
import ComunicadosPage from '../../src/pages/ComunicadosPage';
import { listarComunicados } from '../../src/api/comunicados.api';
import { listarGastos } from '../../src/api/transparencia.api';
import { comunicadosPrueba } from '../../src/mocks/comunicados';

vi.mock('../../src/api/comunicados.api', () => ({ listarComunicados: vi.fn() }));
vi.mock('../../src/api/transparencia.api', () => ({ listarGastos: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

describe('ComunicadosPage', () => {
  it('muestra carga y después el estado vacío', async () => {
    let resolver;
    listarComunicados.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    renderPagina(<ComunicadosPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando comunicados');
    resolver({ success: true, comunicados: [] });
    expect(await screen.findByText('No hay comunicados por el momento')).toBeInTheDocument();
  });

  it('permite reintentar después de un error', async () => {
    listarComunicados.mockResolvedValueOnce({ success: false, error: 'Sin conexión' })
      .mockResolvedValueOnce({ success: true, comunicados: comunicadosPrueba.slice(0, 1) });
    renderPagina(<ComunicadosPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Aviso de prueba 12' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pagina y conserva los avisos al cambiar de pestaña', async () => {
    listarComunicados.mockResolvedValue({ success: true, comunicados: comunicadosPrueba });
    listarGastos.mockResolvedValue({ success: true, publicaciones: [], pagina: 1, totalPaginas: 0 });
    renderPagina(<ComunicadosPage />);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(10));
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Transparencia' }));
    expect(await screen.findByText('Aún no hay gastos publicados')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Avisos' })).toHaveFocus();
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(listarComunicados).toHaveBeenCalledTimes(1);
    expect(listarGastos).toHaveBeenCalledTimes(1);
  });

  it('no carga los gastos hasta abrir la pestaña Transparencia', async () => {
    listarComunicados.mockResolvedValue({ success: true, comunicados: [] });
    renderPagina(<ComunicadosPage />);
    await screen.findByText('No hay comunicados por el momento');
    expect(listarGastos).not.toHaveBeenCalled();
  });
});
