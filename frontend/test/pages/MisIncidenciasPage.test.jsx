// CU-15: pantalla "Mis reportes" del residente
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/api/client', () => ({ listarMisIncidencias: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import MisIncidenciasPage from '../../src/pages/MisIncidenciasPage';
import { listarMisIncidencias } from '../../src/api/client';
import { renderPagina } from '../helpers/render';

// Fechas relativas a hoy: la etiqueta "Actualizada" depende de los últimos 7 días
const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

const incidenciasPrueba = [
  {
    id: 4,
    titulo: 'Portón atorado',
    descripcion: 'El portón del estacionamiento no abre completo.',
    ubicacion: 'Estacionamiento',
    estado: 'resuelto',
    responsable: 'Herrería Díaz',
    fecha_creacion: hace(40),
    fecha_actualizacion: hace(30),
    fecha_resolucion: hace(30),
  },
  {
    id: 3,
    titulo: 'Luz fundida en el lobby',
    descripcion: 'No enciende la lámpara de la entrada.',
    ubicacion: 'Lobby',
    estado: 'resuelto',
    responsable: 'Mantenimiento',
    fecha_creacion: hace(5),
    fecha_actualizacion: hace(3),
    fecha_resolucion: hace(3),
  },
  {
    id: 2,
    titulo: 'Fuga en pasillo',
    descripcion: 'Hay agua en el piso del segundo nivel.',
    ubicacion: 'Pasillo 2',
    estado: 'en_proceso',
    responsable: 'Plomería López',
    fecha_creacion: hace(4),
    fecha_actualizacion: hace(2),
    fecha_resolucion: null,
  },
  {
    id: 1,
    titulo: 'Ruido en el elevador',
    descripcion: 'Hace un ruido metálico al subir.',
    ubicacion: null,
    estado: 'abierto',
    responsable: null,
    fecha_creacion: hace(1),
    fecha_actualizacion: hace(1),
    fecha_resolucion: null,
  },
];

const tarjetaDe = (titulo) => within(screen.getByRole('article', { name: titulo }));
const filtro = (nombre) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) });

let user;
beforeEach(() => {
  user = userEvent.setup({ delay: null });
});

describe('CU-15 MisIncidenciasPage', () => {
  it('muestra la carga y después el estado vacío con botón para reportar', async () => {
    let resolver;
    vi.mocked(listarMisIncidencias).mockReturnValue(new Promise((r) => { resolver = r; }));
    renderPagina(<MisIncidenciasPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus reportes');

    resolver({ success: true, incidencias: [] });

    expect(await screen.findByText('No has reportado incidencias')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reportar una incidencia' }))
      .toHaveAttribute('href', '/incidencias/reportar');
    expect(screen.queryByRole('group', { name: 'Filtrar por estado' })).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(listarMisIncidencias)
      .mockResolvedValueOnce({ success: false, error: 'No se pudo conectar con el servidor.' })
      .mockResolvedValueOnce({ success: true, incidencias: [incidenciasPrueba[2]] });
    renderPagina(<MisIncidenciasPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('article', { name: 'Fuga en pasillo' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listarMisIncidencias).toHaveBeenCalledTimes(2);
  });

  it('muestra estado con texto, ubicación, responsable y fechas de cada reporte', async () => {
    vi.mocked(listarMisIncidencias).mockResolvedValue({ success: true, incidencias: incidenciasPrueba });
    renderPagina(<MisIncidenciasPage />);
    expect(await screen.findAllByRole('article')).toHaveLength(4);

    const enProceso = tarjetaDe('Fuga en pasillo');
    expect(enProceso.getByText('En proceso')).toBeInTheDocument();
    expect(enProceso.getByText('Pasillo 2')).toBeInTheDocument();
    expect(enProceso.getByText('Plomería López')).toBeInTheDocument();
    expect(enProceso.getByText('Reportada')).toBeInTheDocument();
    expect(enProceso.getByText('Última actualización')).toBeInTheDocument();
    expect(enProceso.queryByText('Resuelta el')).not.toBeInTheDocument();

    const abierta = tarjetaDe('Ruido en el elevador');
    expect(abierta.getByText('Abierta')).toBeInTheDocument();
    expect(abierta.getByText('Sin responsable todavía')).toBeInTheDocument();
    expect(abierta.queryByText('Última actualización')).not.toBeInTheDocument();

    const resuelta = tarjetaDe('Luz fundida en el lobby');
    expect(resuelta.getByText('Resuelta')).toBeInTheDocument();
    expect(resuelta.getByText('Resuelta el')).toBeInTheDocument();
    expect(resuelta.getAllByRole('time').at(-1)).toHaveAttribute('datetime', incidenciasPrueba[1].fecha_resolucion);
  });

  it('filtra por estado sobre la lista cargada, con el conteo de cada filtro', async () => {
    vi.mocked(listarMisIncidencias).mockResolvedValue({ success: true, incidencias: incidenciasPrueba });
    renderPagina(<MisIncidenciasPage />);
    await screen.findAllByRole('article');

    expect(filtro('Todas')).toHaveTextContent('(4)');
    expect(filtro('Resueltas')).toHaveTextContent('(2)');
    expect(filtro('Todas')).toHaveAttribute('aria-pressed', 'true');

    await user.click(filtro('Abiertas'));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Ruido en el elevador' })).toBeInTheDocument();
    expect(filtro('Abiertas')).toHaveAttribute('aria-pressed', 'true');

    await user.click(filtro('En proceso'));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Fuga en pasillo' })).toBeInTheDocument();

    await user.click(filtro('Resueltas'));
    expect(screen.getAllByRole('article')).toHaveLength(2);

    await user.click(filtro('Todas'));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    // Filtrar no vuelve a consultar al backend
    expect(listarMisIncidencias).toHaveBeenCalledTimes(1);
  });

  it('avisa cuando el filtro elegido no tiene reportes', async () => {
    vi.mocked(listarMisIncidencias).mockResolvedValue({ success: true, incidencias: [incidenciasPrueba[3]] });
    renderPagina(<MisIncidenciasPage />);
    await screen.findAllByRole('article');

    await user.click(filtro('Resueltas'));

    expect(screen.getByText('No tienes reportes con este estado.')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('marca "Actualizada" solo lo que cambió después de reportarse y en los últimos 7 días', async () => {
    vi.mocked(listarMisIncidencias).mockResolvedValue({ success: true, incidencias: incidenciasPrueba });
    renderPagina(<MisIncidenciasPage />);
    await screen.findAllByRole('article');

    expect(screen.getAllByText('Actualizada')).toHaveLength(2);
    expect(tarjetaDe('Fuga en pasillo').getByText('Actualizada')).toBeInTheDocument();
    expect(tarjetaDe('Luz fundida en el lobby').getByText('Actualizada')).toBeInTheDocument();
    // Cambió hace 30 días: ya no es reciente
    expect(tarjetaDe('Portón atorado').queryByText('Actualizada')).not.toBeInTheDocument();
    // Nunca ha cambiado desde que se reportó
    expect(tarjetaDe('Ruido en el elevador').queryByText('Actualizada')).not.toBeInTheDocument();
  });
});
