// CU-14: ventana de recordatorio de pago que ve el residente al entrar.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/recordatorios.api', () => ({
  obtenerRecordatorioPendiente: vi.fn(),
  marcarRecordatorioVisto: vi.fn(),
}));

import RecordatorioPagoModal from '../../src/components/RecordatorioPagoModal';
import { marcarRecordatorioVisto, obtenerRecordatorioPendiente } from '../../src/api/recordatorios.api';
import { renderPagina } from '../helpers/render';

const recordatorio = { id: 7, fecha_envio: '2026-11-06T10:00:00.000Z', cargos_pendientes: 2, adeudo: 3000.5 };
const rutasExtra = { '/residentes/estado-cuenta': 'Pantalla Mis cuotas' };

let user;
beforeEach(() => {
  user = userEvent.setup({ delay: null });
  vi.mocked(obtenerRecordatorioPendiente).mockResolvedValue({ success: true, recordatorio });
  vi.mocked(marcarRecordatorioVisto).mockResolvedValue({ success: true });
});

describe('CU-14 RecordatorioPagoModal', () => {
  it('muestra los pagos pendientes con el número de cuotas y el adeudo', async () => {
    renderPagina(<RecordatorioPagoModal />);

    const dialogo = await screen.findByRole('alertdialog', { name: 'Tienes pagos pendientes' });
    expect(dialogo).toHaveTextContent('Tienes 2 cuotas pendientes por un total de $3,000.50');
    expect(screen.getByRole('button', { name: 'Ver mis cuotas' })).toHaveFocus();
  });

  it('usa singular con una sola cuota', async () => {
    vi.mocked(obtenerRecordatorioPendiente).mockResolvedValue({
      success: true, recordatorio: { ...recordatorio, cargos_pendientes: 1, adeudo: 1500 },
    });
    renderPagina(<RecordatorioPagoModal />);

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Tienes 1 cuota pendiente por un total de $1,500.00');
  });

  it('"Entendido" lo cierra y lo marca como visto', async () => {
    renderPagina(<RecordatorioPagoModal />);
    await user.click(await screen.findByRole('button', { name: 'Entendido' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(marcarRecordatorioVisto).toHaveBeenCalledWith(7);
  });

  it('"Ver mis cuotas" lo marca como visto y lleva al estado de cuenta', async () => {
    renderPagina(<RecordatorioPagoModal />, { rutasExtra });
    await user.click(await screen.findByRole('button', { name: 'Ver mis cuotas' }));

    expect(await screen.findByText('Pantalla Mis cuotas')).toBeInTheDocument();
    expect(marcarRecordatorioVisto).toHaveBeenCalledWith(7);
  });

  it('Escape también lo cierra', async () => {
    renderPagina(<RecordatorioPagoModal />);
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(marcarRecordatorioVisto).toHaveBeenCalledWith(7);
  });

  it.each([
    ['no hay recordatorio', { success: true, recordatorio: null }],
    ['la consulta falla', { success: false, error: 'No se pudo conectar con el servidor.' }],
  ])('no muestra nada si %s', async (_caso, respuesta) => {
    vi.mocked(obtenerRecordatorioPendiente).mockResolvedValue(respuesta);
    renderPagina(<RecordatorioPagoModal />);

    await vi.waitFor(() => expect(obtenerRecordatorioPendiente).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
