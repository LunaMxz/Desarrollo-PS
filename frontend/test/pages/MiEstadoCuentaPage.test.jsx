// CU-07: vista "Mi estado de cuenta" del residente.
// Se mockea la función de la API y la sesión: no se hacen peticiones reales.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../src/api/client', () => ({ obtenerMiEstadoCuenta: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import MiEstadoCuentaPage from '../../src/pages/MiEstadoCuentaPage';
import { obtenerMiEstadoCuenta } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

function crearEstadoCuenta(sobrescribir = {}) {
  return {
    unidad: { id: 5, identificador: 'A-101' },
    cargos: [
      {
        id: 11, concepto: 'Cuota mensual', monto: '1500.00', periodo: '2026-11', estado: 'pendiente',
        total_pagado: 0, saldo_pendiente: 1500, pagos: [],
      },
      {
        id: 10, concepto: 'Cuota mensual', monto: '1500.00', periodo: '2026-10', estado: 'parcial',
        total_pagado: 500, saldo_pendiente: 1000, pagos: [],
      },
    ],
    pagos: [
      { id: 7, cargo_id: 10, periodo: '2026-10', concepto: 'Cuota mensual', monto: '500.00', fecha_pago: '2026-10-05T18:00:00.000Z' },
    ],
    resumen: { total_cargado: 3000, total_pagado: 500 },
    saldoActual: 2500,
    ...sobrescribir,
  };
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <MiEstadoCuentaPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ user: { rol: 'residente' }, logout: vi.fn() });
  vi.mocked(obtenerMiEstadoCuenta).mockResolvedValue({ success: true, estadoCuenta: crearEstadoCuenta() });
});

describe('CU-07 MiEstadoCuentaPage', () => {
  it('pide el estado de cuenta al cargar y muestra un aviso mientras carga', async () => {
    renderPagina();

    expect(screen.getByText('Cargando tu estado de cuenta…')).toBeInTheDocument();
    expect(obtenerMiEstadoCuenta).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Saldo actual')).toBeInTheDocument();
    expect(screen.queryByText('Cargando tu estado de cuenta…')).not.toBeInTheDocument();
  });

  it('destaca el saldo actual, el resumen y la unidad', async () => {
    renderPagina();

    expect(await screen.findByTestId('saldo-actual')).toHaveTextContent('$2,500.00');
    expect(screen.getByText('Pendiente de pago.')).toBeInTheDocument();
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
    expect(screen.getByText(/Unidad A-101/)).toBeInTheDocument();
  });

  it('muestra la tabla de cargos con periodo, monto, saldo y estado', async () => {
    renderPagina();

    const tabla = await screen.findByRole('table', { name: 'Cargos' });
    const filas = within(tabla).getAllByRole('row').slice(1); // sin encabezado
    expect(filas).toHaveLength(2);

    const parcial = within(filas[1]);
    expect(parcial.getByText('Octubre 2026')).toBeInTheDocument();
    expect(parcial.getByText('$1,500.00')).toBeInTheDocument();
    expect(parcial.getByText('$500.00')).toBeInTheDocument();
    expect(parcial.getByText('$1,000.00')).toBeInTheDocument();
    expect(parcial.getByText('Parcial')).toBeInTheDocument();

    expect(within(filas[0]).getByText('Noviembre 2026')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Pendiente')).toBeInTheDocument();
  });

  it('muestra la tabla de pagos realizados', async () => {
    renderPagina();

    const tabla = await screen.findByRole('table', { name: 'Pagos realizados' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText(/5 oct.* 2026/)).toBeInTheDocument();
    expect(within(filas[0]).getByText('Cuota mensual · Octubre 2026')).toBeInTheDocument();
    expect(within(filas[0]).getByText('$500.00')).toBeInTheDocument();
  });

  it('estado vacío: "Aún no tienes cargos registrados" y sin tablas ni saldo', async () => {
    vi.mocked(obtenerMiEstadoCuenta).mockResolvedValue({
      success: true,
      estadoCuenta: crearEstadoCuenta({ cargos: [], pagos: [], resumen: { total_cargado: 0, total_pagado: 0 }, saldoActual: 0 }),
    });

    renderPagina();

    expect(await screen.findByText('Aún no tienes cargos registrados')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Saldo actual')).not.toBeInTheDocument();
  });

  it('con cargos pero sin pagos avisa que aún no hay pagos', async () => {
    vi.mocked(obtenerMiEstadoCuenta).mockResolvedValue({
      success: true,
      estadoCuenta: crearEstadoCuenta({ pagos: [] }),
    });

    renderPagina();

    expect(await screen.findByText('Aún no tienes pagos registrados.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Cargos' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Pagos realizados' })).not.toBeInTheDocument();
  });

  it('saldo en 0: indica que el residente está al corriente', async () => {
    vi.mocked(obtenerMiEstadoCuenta).mockResolvedValue({
      success: true,
      estadoCuenta: crearEstadoCuenta({ saldoActual: 0 }),
    });

    renderPagina();

    expect(await screen.findByTestId('saldo-actual')).toHaveTextContent('$0.00');
    expect(screen.getByText(/Estás al corriente/)).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(obtenerMiEstadoCuenta)
      .mockResolvedValueOnce({ success: false, error: 'No se pudo conectar con el servidor.' })
      .mockResolvedValueOnce({ success: true, estadoCuenta: crearEstadoCuenta() });
    const user = userEvent.setup();

    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByTestId('saldo-actual')).toHaveTextContent('$2,500.00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(obtenerMiEstadoCuenta).toHaveBeenCalledTimes(2);
  });

  it('tiene un enlace para volver al inicio del residente', async () => {
    renderPagina();

    expect(screen.getByRole('link', { name: /Volver al inicio/ })).toHaveAttribute('href', '/residentes');
    await screen.findByText('Saldo actual');
  });
});
