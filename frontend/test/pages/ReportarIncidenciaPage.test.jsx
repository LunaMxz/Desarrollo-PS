// CU-03: reportar incidencia (residente).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', () => ({ default: { post: vi.fn() } }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import ReportarIncidenciaPage from '../../src/pages/ReportarIncidenciaPage';
import apiClient from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

async function llenar(user, { titulo = 'Fuga de agua', descripcion = 'Hay agua en el pasillo', ubicacion = 'Torre B' } = {}) {
  if (titulo) await user.type(screen.getByLabelText(/Título/), titulo);
  if (descripcion) await user.type(screen.getByLabelText(/Descripción/), descripcion);
  if (ubicacion) await user.type(screen.getByLabelText('Ubicación'), ubicacion);
}

function enviar(user) {
  return user.click(screen.getByRole('button', { name: 'Reportar incidencia' }));
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
});

describe('CU-03 ReportarIncidenciaPage', () => {
  it('envía la incidencia (sin espacios sobrantes) y limpia el formulario', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderPagina(<ReportarIncidenciaPage />);

    await llenar(user, { titulo: '  Fuga de agua  ' });
    await enviar(user);

    expect(apiClient.post).toHaveBeenCalledWith('/incidencias', {
      titulo: 'Fuga de agua',
      descripcion: 'Hay agua en el pasillo',
      ubicacion: 'Torre B',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Incidencia reportada correctamente.');
    expect(screen.getByLabelText(/Título/)).toHaveValue('');
  });

  it('título y descripción son obligatorios', async () => {
    const user = userEvent.setup();
    renderPagina(<ReportarIncidenciaPage />);

    await enviar(user);

    expect(screen.getByText('El título es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La descripción es obligatoria.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('el error de un campo desaparece al corregirlo', async () => {
    const user = userEvent.setup();
    renderPagina(<ReportarIncidenciaPage />);

    await enviar(user);
    await user.type(screen.getByLabelText(/Título/), 'F');

    expect(screen.queryByText('El título es obligatorio.')).not.toBeInTheDocument();
    expect(screen.getByText('La descripción es obligatoria.')).toBeInTheDocument();
  });

  it.each([
    [{ code: 'ECONNABORTED' }, 'El servidor tardó demasiado en responder. Intente más tarde.'],
    [{ code: 'ERR_NETWORK' }, 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.'],
    [{ response: { status: 400, data: { error: 'El título es obligatorio' } } }, 'El título es obligatorio'],
    [{ response: { status: 500, data: {} } }, 'Ocurrió un error inesperado. Intenta más tarde.'],
  ])('si falla el envío muestra el error y conserva lo capturado (%#)', async (falla, mensaje) => {
    vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error('falla'), falla));
    const user = userEvent.setup();
    renderPagina(<ReportarIncidenciaPage />);

    await llenar(user);
    await enviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(screen.getByLabelText(/Título/)).toHaveValue('Fuga de agua');
  });

  it('cancelar regresa a la pantalla anterior', async () => {
    const user = userEvent.setup();
    renderPagina(<ReportarIncidenciaPage />, { ruta: '/incidencias/reportar' });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
