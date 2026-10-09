// CU-07: navegación hacia "Mi estado de cuenta" usando el App real
// (AuthProvider + rutas protegidas). Solo se mockea la llamada a la API.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerMiEstadoCuenta: vi.fn(),
}));

import App from '../../src/App';
import { obtenerMiEstadoCuenta } from '../../src/api/client';

function iniciarSesionComo(usuario, ruta) {
  localStorage.setItem('token', 'token-de-prueba');
  localStorage.setItem('user', JSON.stringify(usuario));
  window.history.pushState({}, '', ruta);
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(obtenerMiEstadoCuenta).mockResolvedValue({
    success: true,
    estadoCuenta: { unidad: null, cargos: [], pagos: [], resumen: { total_cargado: 0, total_pagado: 0 }, saldoActual: 0 },
  });
});

describe('CU-07 ruta /residentes/estado-cuenta', () => {
  it('el residente llega desde la tarjeta "Mis cuotas" del inicio', async () => {
    iniciarSesionComo({ id: 2, correo: 'residente@condominio.com', rol: 'residente' }, '/residentes');
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Mis cuotas/ }));

    expect(await screen.findByText('Aún no tienes cargos registrados')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/residentes/estado-cuenta');
  });

  it('un administrador no puede abrir la vista del residente', async () => {
    iniciarSesionComo({ id: 1, correo: 'admin@condominio.com', rol: 'admin' }, '/residentes/estado-cuenta');

    render(<App />);

    expect(await screen.findByText('No tienes permiso para ver esta página')).toBeInTheDocument();
    expect(obtenerMiEstadoCuenta).not.toHaveBeenCalled();
  });

  it('sin sesión redirige al login', async () => {
    window.history.pushState({}, '', '/residentes/estado-cuenta');

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(obtenerMiEstadoCuenta).not.toHaveBeenCalled();
  });
});
