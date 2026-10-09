// CU-02: registrar pago (administrador).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  listarResidentes: vi.fn(),
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import RegistrarPagoPage from '../../src/pages/RegistrarPagoPage';
import apiClient, { listarResidentes } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

const residentes = [
  { id: 1, unidad_id: 5, unidad_identificador: 'A-101' },
  { id: 2, unidad_id: 5, unidad_identificador: 'A-101' }, // residente anterior de la misma unidad
  { id: 3, unidad_id: 6, unidad_identificador: 'B-202' },
];

function cargo(sobrescribir = {}) {
  return { id: 10, concepto: 'Cuota mensual', monto: '1500.00', periodo: '2026-10', estado: 'pendiente', total_pagado: 0, saldo_pendiente: 1500, ...sobrescribir };
}

function errorHttp(status, error) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { error } } });
}

async function abrirCargo(user, unidad = 'A-101') {
  await user.click(await screen.findByRole('button', { name: unidad }));
  await user.click(await screen.findByRole('button', { name: /Cuota mensual/ }));
}

async function pagar(user, monto) {
  await user.type(screen.getByLabelText(/Monto del pago/), monto);
  await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
  vi.mocked(listarResidentes).mockResolvedValue({ success: true, residentes });
  vi.mocked(apiClient.get).mockResolvedValue({ data: { cargos: [cargo()] } });
});

describe('CU-02 RegistrarPagoPage', () => {
  it('muestra las unidades sin repetir (incluye residentes inactivos)', async () => {
    renderPagina(<RegistrarPagoPage />);

    expect(await screen.findAllByRole('button', { name: 'A-101' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'B-202' })).toBeInTheDocument();
    expect(listarResidentes).toHaveBeenCalledWith(false);
  });

  it('filtra las unidades por el buscador', async () => {
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);

    await user.type(await screen.findByLabelText(/Buscar por identificador/), 'b-2');

    expect(screen.queryByRole('button', { name: 'A-101' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B-202' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Buscar por identificador/));
    await user.type(screen.getByLabelText(/Buscar por identificador/), 'Z-9');
    expect(screen.getByText('No se encontraron unidades con ese identificador.')).toBeInTheDocument();
  });

  it('error al cargar unidades y reintento', async () => {
    vi.mocked(listarResidentes)
      .mockResolvedValueOnce({ success: false, error: 'Sin conexión' })
      .mockResolvedValueOnce({ success: true, residentes });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: 'A-101' })).toBeInTheDocument();
  });

  it('muestra los cargos de la unidad con su saldo pendiente', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { cargos: [cargo({ estado: 'parcial', total_pagado: 500, saldo_pendiente: 1000 })] } });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);

    await abrirCargo(user);

    expect(apiClient.get).toHaveBeenCalledWith('/pagos/unidades/5/cargos');
    expect(screen.getByText(/Saldo pendiente: \$1,000\.00/, { selector: '.registrar-pago-detalle' })).toBeInTheDocument();
    expect(screen.getByText(/abonos previos por \$500\.00/)).toBeInTheDocument();
  });

  it('avisa si la unidad no tiene cargos pendientes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { cargos: [] } });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);

    await user.click(await screen.findByRole('button', { name: 'A-101' }));

    expect(await screen.findByText('Esta unidad no tiene cargos pendientes ni parciales.')).toBeInTheDocument();
  });

  it('error al cargar cargos y reintento', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(errorHttp(404, 'Unidad no encontrada'))
      .mockResolvedValueOnce({ data: { cargos: [cargo()] } });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);

    await user.click(await screen.findByRole('button', { name: 'A-101' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unidad no encontrada');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: /Cuota mensual/ })).toBeInTheDocument();
  });

  it('pago parcial: el cargo cambia a parcial', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { pago: { fecha_pago: '2026-10-08T18:00:00.000Z', cargo: cargo({ estado: 'parcial', total_pagado: 500, saldo_pendiente: 1000 }) } },
    });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, '500');

    expect(apiClient.post).toHaveBeenCalledWith('/pagos', { cargo_id: 10, monto: 500 });
    expect(await screen.findByRole('status')).toHaveTextContent('Pago registrado. El cargo quedó parcial.');
    expect(screen.getByLabelText(/Monto del pago/)).toHaveValue('');
  });

  it('liquidar el cargo lo marca pagado y oculta el formulario', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { pago: { fecha_pago: '2026-10-08T18:00:00.000Z', cargo: cargo({ estado: 'pagado', total_pagado: 1500, saldo_pendiente: 0 }) } },
    });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, '1500');

    expect(await screen.findByText(/Pago registrado. El cargo quedó pagado/)).toBeInTheDocument();
    expect(screen.getByText('Esta unidad no tiene cargos pendientes ni parciales.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Monto del pago/)).not.toBeInTheDocument();
  });

  it('no deja pagar más del saldo pendiente', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { cargos: [cargo({ estado: 'parcial', total_pagado: 500, saldo_pendiente: 1000 })] } });
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, '1000.01');

    expect(screen.getByRole('alert')).toHaveTextContent('El pago no puede exceder el saldo pendiente ($1,000.00).');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each(['0', 'abc', '10.123'])('rechaza el monto inválido "%s"', async (monto) => {
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, monto);

    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un monto mayor a cero con máximo dos decimales.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('409: el cargo ya estaba pagado', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(errorHttp(409, 'El cargo ya está pagado'));
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, '100');

    expect(await screen.findByRole('alert')).toHaveTextContent('El cargo ya está pagado. No se registró otro pago.');
    expect(screen.queryByLabelText(/Monto del pago/)).not.toBeInTheDocument();
  });

  it('otro error al registrar el pago', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(errorHttp(400, 'El monto excede el saldo pendiente del cargo'));
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, '100');

    expect(await screen.findByRole('alert')).toHaveTextContent('El monto excede el saldo pendiente del cargo');
  });

  it('mensaje genérico si no hay respuesta del servidor', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    renderPagina(<RegistrarPagoPage />);
    await abrirCargo(user);

    await pagar(user, '100');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la solicitud');
  });
});
