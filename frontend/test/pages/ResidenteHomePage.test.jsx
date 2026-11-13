import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPagina } from '../helpers/render';
import ResidenteHomePage from '../../src/pages/ResidenteHomePage';
import { listarMisIncidencias, obtenerMiEstadoCuenta } from '../../src/api/client';
import { listarComunicados } from '../../src/api/comunicados.api';
import { obtenerRecordatorioPendiente } from '../../src/api/recordatorios.api';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { correo: 'residente@ejemplo.com', rol: 'residente' }, logout: vi.fn() }) }));
vi.mock('../../src/api/recordatorios.api', () => ({ obtenerRecordatorioPendiente: vi.fn(), marcarRecordatorioVisto: vi.fn() }));
vi.mock('../../src/api/client', () => ({ listarMisIncidencias: vi.fn(), obtenerMiEstadoCuenta: vi.fn() }));
vi.mock('../../src/api/comunicados.api', () => ({ listarComunicados: vi.fn() }));

beforeEach(() => {
  obtenerRecordatorioPendiente.mockResolvedValue({ success: true, recordatorio: null });
  obtenerMiEstadoCuenta.mockResolvedValue({ success: true, estadoCuenta: {
    unidad: { identificador: 'Depto 301' }, saldoActual: 1500, cargos: [{ estado: 'parcial' }],
  } });
  listarMisIncidencias.mockResolvedValue({ success: true, incidencias: [{ id: 1, titulo: 'Fuga de agua', estado: 'en_proceso', responsable: 'Mantenimiento', fecha_creacion: '2026-11-01', fecha_actualizacion: '2026-11-01' }] });
  listarComunicados.mockResolvedValue({ success: true, comunicados: [{ id: 1, titulo: 'Reunión vecinal', contenido: 'Nos vemos el viernes.', fecha_publicacion: '2026-11-01' }] });
});

describe('Inicio del residente', () => {
  it('presenta su saldo, reportes y avisos conservando los accesos', async () => {
    renderPagina(<ResidenteHomePage />);
    expect(await screen.findByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('Depto 301')).toBeInTheDocument();
    expect(await screen.findByText('En proceso')).toBeInTheDocument();
    expect(await screen.findByText('Reunión vecinal')).toBeInTheDocument();
    expect(listarMisIncidencias).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Reportar incidencia/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mis reportes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mis cuotas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Comunicados/ })).toBeInTheDocument();
  });

  it('permite reintentar las cuotas sin bloquear reportes ni avisos', async () => {
    obtenerMiEstadoCuenta.mockResolvedValueOnce({ success: false });
    renderPagina(<ResidenteHomePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar tus cuotas');
    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar tus cuotas' }));
    expect(await screen.findByText('$1,500.00')).toBeInTheDocument();
    expect(listarComunicados).toHaveBeenCalledTimes(1);
  });

  it('muestra los estados vacíos y el saldo al corriente', async () => {
    obtenerMiEstadoCuenta.mockResolvedValue({ success: true, estadoCuenta: { saldoActual: 0, cargos: [] } });
    listarMisIncidencias.mockResolvedValue({ success: true, incidencias: [] });
    listarComunicados.mockResolvedValue({ success: true, comunicados: [] });
    renderPagina(<ResidenteHomePage />);
    expect(await screen.findByText('Estás al corriente')).toBeInTheDocument();
    expect(await screen.findByText('Aún no has registrado incidencias.')).toBeInTheDocument();
    expect(await screen.findByText('No hay avisos publicados por el momento.')).toBeInTheDocument();
  });

  // CU-14
  it('al entrar muestra el recordatorio de pago que mandó la administración', async () => {
    obtenerRecordatorioPendiente.mockResolvedValue({ success: true, recordatorio: { id: 3, cargos_pendientes: 2, adeudo: 3000 } });
    renderPagina(<ResidenteHomePage />);

    expect(await screen.findByRole('alertdialog', { name: 'Tienes pagos pendientes' })).toBeInTheDocument();
  });

  // CU-15
  it('avisa cuántos reportes se actualizaron en los últimos 7 días', async () => {
    const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    listarMisIncidencias.mockResolvedValue({ success: true, incidencias: [
      { id: 1, titulo: 'Fuga', estado: 'en_proceso', fecha_creacion: hace(5), fecha_actualizacion: hace(1) },
      { id: 2, titulo: 'Luz', estado: 'resuelto', fecha_creacion: hace(9), fecha_actualizacion: hace(2) },
      { id: 3, titulo: 'Ruido', estado: 'resuelto', fecha_creacion: hace(30), fecha_actualizacion: hace(20) },
      { id: 4, titulo: 'Puerta', estado: 'abierto', fecha_creacion: hace(1), fecha_actualizacion: hace(1) },
    ] });
    const user = userEvent.setup({ delay: null });
    renderPagina(<ResidenteHomePage />, { rutasExtra: { '/residentes/incidencias': 'Pantalla Mis reportes' } });

    expect(await screen.findByText('Tienes 2 reportes actualizados recientemente')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Ver mis reportes →' }));
    expect(await screen.findByText('Pantalla Mis reportes')).toBeInTheDocument();
  });

  it('sin cambios recientes no muestra el aviso; la tarjeta lleva a Mis reportes', async () => {
    const user = userEvent.setup({ delay: null });
    renderPagina(<ResidenteHomePage />, { rutasExtra: { '/residentes/incidencias': 'Pantalla Mis reportes' } });

    expect(await screen.findByText('Fuga de agua')).toBeInTheDocument();
    expect(screen.queryByText(/actualizados? recientemente/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mis reportes/ }));
    expect(await screen.findByText('Pantalla Mis reportes')).toBeInTheDocument();
  });
});
