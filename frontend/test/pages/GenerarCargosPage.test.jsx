// CU-06: generar cargos del mes (administrador).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({ generarCargos: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import GenerarCargosPage from '../../src/pages/GenerarCargosPage';
import { generarCargos } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

const exito = {
  success: true,
  mensaje: 'Cargos generados para el periodo 2026-10: 2',
  periodo: '2026-10',
  cargos: [{ id: 1 }, { id: 2 }],
  omitidas: [],
  sinUnidades: false,
};

async function generar(user, monto) {
  if (monto) await user.type(screen.getByLabelText(/Monto de la cuota mensual/), monto);
  await user.click(screen.getByRole('button', { name: 'Generar cargos del mes' }));
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
});

describe('CU-06 GenerarCargosPage', () => {
  it('genera los cargos y muestra el resumen', async () => {
    vi.mocked(generarCargos).mockResolvedValue(exito);
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '1500');

    expect(generarCargos).toHaveBeenCalledWith(1500);
    expect(await screen.findByRole('status')).toHaveTextContent('Cargos generados para el periodo 2026-10: 2');
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/octubre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Monto de la cuota mensual/)).toHaveValue('');
  });

  it('lista las unidades omitidas por ya tener cargo', async () => {
    vi.mocked(generarCargos).mockResolvedValue({ ...exito, cargos: [{ id: 2 }], omitidas: [{ unidad_id: 1, identificador: 'A-101' }] });
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '1500');

    expect(await screen.findByText('Omitidas (ya tenían cargo)')).toBeInTheDocument();
    expect(screen.getByText('A-101')).toBeInTheDocument();
  });

  it('segundo intento en el mismo mes: aviso amigable de duplicado', async () => {
    vi.mocked(generarCargos).mockResolvedValue({ success: false, duplicado: true, error: 'Los cargos del periodo 2026-10 ya fueron generados' });
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '1500');

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Los cargos del periodo 2026-10 ya fueron generados');
    expect(aviso).toHaveClass('generar-cargos-aviso--duplicado');
  });

  it('avisa si no hay unidades con residente activo', async () => {
    vi.mocked(generarCargos).mockResolvedValue({ ...exito, cargos: [], sinUnidades: true, mensaje: 'No hay unidades con residente activo' });
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '1500');

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay unidades con residente activo');
    expect(screen.queryByText('Cargos generados')).not.toBeInTheDocument();
  });

  it('muestra otros errores', async () => {
    vi.mocked(generarCargos).mockResolvedValue({ success: false, duplicado: false, error: 'No tienes permiso para generar cargos.' });
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '1500');

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('No tienes permiso para generar cargos.');
    expect(aviso).toHaveClass('generar-cargos-aviso--error');
  });

  it.each([
    ['', 'Ingresa el monto de la cuota mensual.'],
    ['0', 'El monto debe ser mayor a $0.'],
    ['2000000', 'El monto no puede exceder $1,000,000.00.'],
  ])('valida el monto "%s"', async (monto, mensaje) => {
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, monto);

    expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
    expect(generarCargos).not.toHaveBeenCalled();
  });

  it('solo acepta números con máximo dos decimales', async () => {
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);
    const input = screen.getByLabelText(/Monto de la cuota mensual/);

    await user.type(input, 'a1.2.345$');

    expect(input).toHaveValue('1.23');
  });

  it('bloquea el doble clic mientras genera', async () => {
    let resolver;
    vi.mocked(generarCargos).mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '1500');
    const boton = screen.getByRole('button', { name: 'Generando…' });
    expect(boton).toBeDisabled();
    await user.click(boton);

    expect(generarCargos).toHaveBeenCalledTimes(1);
    resolver(exito);
    expect(await screen.findByRole('button', { name: 'Generar cargos del mes' })).toBeEnabled();
  });

  it('al escribir de nuevo se limpia el error del campo', async () => {
    const user = userEvent.setup();
    renderPagina(<GenerarCargosPage />);

    await generar(user, '');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Monto de la cuota mensual/), '1');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(document.body).queryByText('Ingresa el monto de la cuota mensual.')).not.toBeInTheDocument();
  });
});
