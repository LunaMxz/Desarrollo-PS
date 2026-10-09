// CU-05: baja de residente (administrador).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({ listarResidentes: vi.fn(), darDeBajaResidente: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import BajaResidentePage from '../../src/pages/BajaResidentePage';
import { listarResidentes, darDeBajaResidente } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

const residentes = [
  { id: 2, correo: 'ana@condominio.com', unidad_id: 5, unidad_identificador: 'A-101' },
  { id: 3, correo: 'bruno@condominio.com', unidad_id: 6 },
];

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
  vi.mocked(listarResidentes).mockResolvedValue({ success: true, residentes });
});

describe('CU-05 BajaResidentePage', () => {
  it('lista solo los residentes activos', async () => {
    renderPagina(<BajaResidentePage />);

    expect(screen.getByText('Cargando residentes…')).toBeInTheDocument();
    expect(await screen.findByText('ana@condominio.com')).toBeInTheDocument();
    expect(screen.getByText('Unidad A-101')).toBeInTheDocument();
    expect(screen.getByText('Unidad 6')).toBeInTheDocument(); // sin identificador usa el id
    expect(listarResidentes).toHaveBeenCalledWith(true);
  });

  it('avisa si no hay residentes activos', async () => {
    vi.mocked(listarResidentes).mockResolvedValue({ success: true, residentes: [] });

    renderPagina(<BajaResidentePage />);

    expect(await screen.findByText('No hay residentes activos.')).toBeInTheDocument();
  });

  it('muestra el error al cargar la lista', async () => {
    vi.mocked(listarResidentes).mockResolvedValue({ success: false, error: 'No tienes permiso para ver los residentes.' });

    renderPagina(<BajaResidentePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para ver los residentes.');
  });

  it('pide confirmación con aviso de saldo y da de baja', async () => {
    vi.mocked(darDeBajaResidente).mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPagina(<BajaResidentePage />);

    await user.click((await screen.findAllByRole('button', { name: 'Dar de baja' }))[0]);
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/Verifique manualmente si el residente tiene saldo pendiente/)).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Confirmar baja' }));

    expect(darDeBajaResidente).toHaveBeenCalledWith(2);
    expect(await screen.findByRole('status')).toHaveTextContent('ana@condominio.com fue dado de baja correctamente.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Unidad A-101')).not.toBeInTheDocument();
  });

  it('cancelar cierra el modal sin dar de baja', async () => {
    const user = userEvent.setup();
    renderPagina(<BajaResidentePage />);

    await user.click((await screen.findAllByRole('button', { name: 'Dar de baja' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(darDeBajaResidente).not.toHaveBeenCalled();
  });

  it('clic fuera del modal lo cierra', async () => {
    const user = userEvent.setup();
    const { container } = renderPagina(<BajaResidentePage />);

    await user.click((await screen.findAllByRole('button', { name: 'Dar de baja' }))[0]);
    await user.click(container.querySelector('.modal-overlay'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si la baja falla, muestra el error dentro del modal', async () => {
    vi.mocked(darDeBajaResidente).mockResolvedValue({ success: false, error: 'El residente no existe.' });
    const user = userEvent.setup();
    renderPagina(<BajaResidentePage />);

    await user.click((await screen.findAllByRole('button', { name: 'Dar de baja' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByText('El residente no existe.')).toBeInTheDocument();
    expect(screen.getByText('Unidad A-101')).toBeInTheDocument();
  });
});
