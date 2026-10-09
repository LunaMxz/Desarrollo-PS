// CU-08 (gestionar incidencias) y CU-09 (resolver incidencia) - administrador.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({
  listarIncidenciasPendientes: vi.fn(),
  listarIncidenciasResueltas: vi.fn(),
  asignarResponsable: vi.fn(),
  resolverIncidencia: vi.fn(),
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import IncidenciasAbiertasPage from '../../src/pages/IncidenciasAbiertasPage';
import {
  listarIncidenciasPendientes,
  listarIncidenciasResueltas,
  asignarResponsable,
  resolverIncidencia,
} from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

const abierta = {
  id: 1, titulo: 'Fuga de agua', descripcion: 'Pasillo mojado', ubicacion: 'Torre B',
  estado: 'abierto', responsable: null, fecha_creacion: '2026-10-01T10:00:00.000Z',
};
const enProceso = {
  id: 2, titulo: 'Foco fundido', ubicacion: null, estado: 'en_proceso',
  responsable: 'Electricidad', fecha_creacion: '2026-10-02T10:00:00.000Z',
};
const resueltas = [
  { id: 3, titulo: 'Puerta rota', ubicacion: 'Lobby', responsable: 'Mantenimiento general', estado: 'resuelto',
    fecha_creacion: '2026-09-01T10:00:00.000Z', fecha_resolucion: '2026-09-03T12:00:00.000Z' },
  { id: 4, titulo: 'Pasto alto', ubicacion: null, responsable: 'Jardinería', estado: 'resuelto',
    fecha_creacion: '2026-09-05T10:00:00.000Z', fecha_resolucion: '2026-09-05T13:30:00.000Z' },
  { id: 5, titulo: 'Basura', responsable: null, estado: 'resuelto',
    fecha_creacion: '2026-09-06T10:00:00.000Z', fecha_resolucion: '2026-09-06T10:20:00.000Z' },
];

function tarjeta(titulo) {
  return screen.getByRole('heading', { name: titulo }).closest('li');
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
  vi.mocked(listarIncidenciasPendientes).mockResolvedValue({ success: true, incidencias: [abierta, enProceso] });
  vi.mocked(listarIncidenciasResueltas).mockResolvedValue({ success: true, incidencias: resueltas });
});

describe('CU-08 pendientes', () => {
  it('lista las incidencias abiertas y en proceso', async () => {
    renderPagina(<IncidenciasAbiertasPage />);

    expect(screen.getByText('Cargando incidencias…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Fuga de agua' })).toBeInTheDocument();
    expect(within(tarjeta('Fuga de agua')).getByText('Sin responsable asignado')).toBeInTheDocument();
    expect(within(tarjeta('Foco fundido')).getByText('Responsable actual: Electricidad')).toBeInTheDocument();
    expect(within(tarjeta('Foco fundido')).getByText(/Sin ubicación/)).toBeInTheDocument();
  });

  it('no deja resolver sin responsable ni asignar sin elegir', async () => {
    renderPagina(<IncidenciasAbiertasPage />);
    const card = within(await screen.findByRole('heading', { name: 'Fuga de agua' }).then((h) => h.closest('li')));

    expect(card.getByRole('button', { name: 'Asignar' })).toBeDisabled();
    expect(card.getByRole('button', { name: 'Marcar como resuelto' })).toBeDisabled();
  });

  it('asigna un responsable y muestra la confirmación', async () => {
    vi.mocked(asignarResponsable).mockResolvedValue({ success: true, incidencia: { estado: 'en_proceso' } });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Fuga de agua' });
    const card = within(tarjeta('Fuga de agua'));

    await user.selectOptions(card.getByLabelText('Responsable'), 'Plomería');
    await user.click(card.getByRole('button', { name: 'Asignar' }));

    expect(asignarResponsable).toHaveBeenCalledWith(1, 'Plomería');
    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('Responsable asignado')).toBeInTheDocument();
    expect(within(tarjeta('Fuga de agua')).getByText('Responsable actual: Plomería')).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reasignar muestra "Responsable reasignado" y Escape cierra el modal', async () => {
    vi.mocked(asignarResponsable).mockResolvedValue({ success: true, incidencia: {} });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Foco fundido' });
    const card = within(tarjeta('Foco fundido'));

    await user.selectOptions(card.getByLabelText('Responsable'), 'Limpieza');
    await user.click(card.getByRole('button', { name: 'Reasignar' }));

    expect(await screen.findByText('Responsable reasignado')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si la incidencia ya no está pendiente tras asignar, sale de la lista', async () => {
    vi.mocked(asignarResponsable).mockResolvedValue({ success: true, incidencia: { estado: 'resuelto' } });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Fuga de agua' });

    await user.selectOptions(within(tarjeta('Fuga de agua')).getByLabelText('Responsable'), 'Plomería');
    await user.click(within(tarjeta('Fuga de agua')).getByRole('button', { name: 'Asignar' }));

    await screen.findByRole('dialog');
    expect(screen.queryByRole('heading', { name: 'Fuga de agua' })).not.toBeInTheDocument();
  });

  it('muestra el error al asignar en la tarjeta', async () => {
    vi.mocked(asignarResponsable).mockResolvedValue({ success: false, error: 'La incidencia no existe.' });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Fuga de agua' });

    await user.selectOptions(within(tarjeta('Fuga de agua')).getByLabelText('Responsable'), 'Plomería');
    await user.click(within(tarjeta('Fuga de agua')).getByRole('button', { name: 'Asignar' }));

    expect(await within(tarjeta('Fuga de agua')).findByRole('alert')).toHaveTextContent('La incidencia no existe.');
  });

  it('error al cargar y reintento', async () => {
    vi.mocked(listarIncidenciasPendientes)
      .mockResolvedValueOnce({ success: false, error: 'Sin conexión' })
      .mockResolvedValueOnce({ success: true, incidencias: [] });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('No hay incidencias pendientes.')).toBeInTheDocument();
  });

  it('muestra un responsable guardado que no está en el catálogo', async () => {
    vi.mocked(listarIncidenciasPendientes).mockResolvedValue({
      success: true,
      incidencias: [{ ...enProceso, responsable: 'Proveedor externo' }],
    });
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Foco fundido' });

    expect(within(tarjeta('Foco fundido')).getByRole('option', { name: 'Proveedor externo' })).toBeInTheDocument();
  });
});

describe('CU-09 resolver', () => {
  it('resuelve una incidencia con responsable y la saca de pendientes', async () => {
    vi.mocked(resolverIncidencia).mockResolvedValue({ success: true, incidencia: { estado: 'resuelto' } });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Foco fundido' });

    await user.click(within(tarjeta('Foco fundido')).getByRole('button', { name: 'Marcar como resuelto' }));

    expect(resolverIncidencia).toHaveBeenCalledWith(2);
    expect(await screen.findByText('Incidencia resuelta')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Foco fundido' })).not.toBeInTheDocument();
  });

  it('una incidencia resuelta aparece al inicio del historial ya cargado', async () => {
    vi.mocked(resolverIncidencia).mockResolvedValue({ success: true, incidencia: { estado: 'resuelto' } });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Foco fundido' });
    await user.click(screen.getByRole('tab', { name: /Historial/ }));
    await screen.findByRole('heading', { name: 'Puerta rota' });
    await user.click(screen.getByRole('tab', { name: /Pendientes/ }));

    await user.click(within(tarjeta('Foco fundido')).getByRole('button', { name: 'Marcar como resuelto' }));
    await user.click(await screen.findByRole('button', { name: 'Entendido' }));
    await user.click(screen.getByRole('tab', { name: /Historial/ }));

    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Foco fundido');
    expect(listarIncidenciasResueltas).toHaveBeenCalledTimes(1);
  });

  it('muestra el error al resolver', async () => {
    vi.mocked(resolverIncidencia).mockResolvedValue({ success: false, error: 'No tienes permiso para gestionar incidencias.' });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Foco fundido' });

    await user.click(within(tarjeta('Foco fundido')).getByRole('button', { name: 'Marcar como resuelto' }));

    expect(await within(tarjeta('Foco fundido')).findByRole('alert')).toHaveTextContent('No tienes permiso');
  });
});

describe('historial de resueltas', () => {
  it('se carga al abrir la pestaña y muestra quién atendió y cuánto tardó', async () => {
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Fuga de agua' });

    await user.click(screen.getByRole('tab', { name: /Historial/ }));

    const puerta = (await screen.findByRole('heading', { name: 'Puerta rota' })).closest('li');
    expect(within(puerta).getByText('Atendida por: Mantenimiento general')).toBeInTheDocument();
    expect(within(puerta).getByText('✓ Resuelta en 2 días')).toBeInTheDocument();
    expect(within(tarjeta('Pasto alto')).getByText('✓ Resuelta en 3 horas')).toBeInTheDocument();
    expect(within(tarjeta('Basura')).getByText('✓ Resuelta en menos de una hora')).toBeInTheDocument();
    expect(within(tarjeta('Basura')).getByText('Atendida por: Sin responsable registrado')).toBeInTheDocument();
  });

  it('filtra por título, responsable o ubicación', async () => {
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await user.click(await screen.findByRole('tab', { name: /Historial/ }));
    await screen.findByRole('heading', { name: 'Puerta rota' });

    await user.type(screen.getByLabelText('Buscar en el historial'), 'jardín');
    expect(screen.getByText('Ninguna incidencia coincide con la búsqueda.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar en el historial'));
    await user.type(screen.getByLabelText('Buscar en el historial'), 'lobby');
    expect(screen.getByRole('heading', { name: 'Puerta rota' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pasto alto' })).not.toBeInTheDocument();
  });

  it('historial vacío', async () => {
    vi.mocked(listarIncidenciasResueltas).mockResolvedValue({ success: true, incidencias: [] });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);

    await user.click(await screen.findByRole('tab', { name: /Historial/ }));

    expect(await screen.findByText('Aún no hay incidencias resueltas.')).toBeInTheDocument();
  });

  it('error al cargar el historial y reintento', async () => {
    vi.mocked(listarIncidenciasResueltas)
      .mockResolvedValueOnce({ success: false, error: 'Sin conexión' })
      .mockResolvedValueOnce({ success: true, incidencias: resueltas });
    const user = userEvent.setup();
    renderPagina(<IncidenciasAbiertasPage />);
    await screen.findByRole('heading', { name: 'Fuga de agua' });

    await user.click(screen.getByRole('tab', { name: /Historial/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Puerta rota' })).toBeInTheDocument();
  });
});
