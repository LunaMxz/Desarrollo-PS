// CU-10: publicar comunicado (administrador).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/client', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, default: { post: vi.fn() } };
});
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import PublicarComunicadoPage from '../../src/pages/PublicarComunicadoPage';
import apiClient from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { renderPagina } from '../helpers/render';

async function llenar(user, { titulo = 'Corte de agua', contenido = 'El jueves de 9 a 13 h' } = {}) {
  if (titulo) await user.type(screen.getByLabelText(/Título/), titulo);
  if (contenido) await user.type(screen.getByLabelText(/Contenido/), contenido);
}

// delay: null escribe sin pausas entre teclas: las pruebas no dependen de qué tan cargada esté la máquina
function enviar(user) {
  return user.click(screen.getByRole('button', { name: 'Publicar comunicado' }));
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
});

describe('CU-10 PublicarComunicadoPage', () => {
  it('publica el comunicado (sin espacios sobrantes), confirma y limpia el formulario', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { comunicado: { id: 1 } } });
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await llenar(user, { titulo: '  Corte de agua  ' });
    await enviar(user);

    expect(apiClient.post).toHaveBeenCalledWith('/comunicados', {
      titulo: 'Corte de agua',
      contenido: 'El jueves de 9 a 13 h',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Comunicado publicado correctamente.');
    expect(screen.getByLabelText(/Título/)).toHaveValue('');
    expect(screen.getByLabelText(/Contenido/)).toHaveValue('');
  });

  it('título y contenido son obligatorios', async () => {
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await enviar(user);

    expect(screen.getByText('El título es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El contenido es obligatorio.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('un campo con solo espacios cuenta como vacío', async () => {
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await llenar(user, { titulo: '   ', contenido: '   ' });
    await enviar(user);

    expect(screen.getByText('El título es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El contenido es obligatorio.')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('el error de un campo desaparece al corregirlo', async () => {
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await enviar(user);
    await user.type(screen.getByLabelText(/Título/), 'A');

    expect(screen.queryByText('El título es obligatorio.')).not.toBeInTheDocument();
    expect(screen.getByText('El contenido es obligatorio.')).toBeInTheDocument();
  });

  it('error del servidor: muestra su mensaje y conserva lo capturado', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      response: { status: 400, data: { error: 'El campo "titulo" es obligatorio' } },
    });
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await llenar(user);
    await enviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('El campo "titulo" es obligatorio');
    expect(screen.getByLabelText(/Título/)).toHaveValue('Corte de agua');
    expect(screen.getByLabelText(/Contenido/)).toHaveValue('El jueves de 9 a 13 h');
  });

  it('sin conexión: avisa del problema de red', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ code: 'ERR_NETWORK' });
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await llenar(user);
    await enviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });

  it('403: avisa que no tiene permiso', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 403, data: {} } });
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await llenar(user);
    await enviar(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para publicar comunicados.');
  });

  it('deshabilita el botón mientras publica', async () => {
    let resolver;
    vi.mocked(apiClient.post).mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />);

    await llenar(user);
    await enviar(user);

    expect(screen.getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    resolver({ data: {} });
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('cancelar regresa al dashboard', async () => {
    const user = userEvent.setup({ delay: null });
    renderPagina(<PublicarComunicadoPage />, {
      ruta: '/admin/comunicados/nuevo',
      rutasExtra: { '/admin/dashboard': 'Panel de administrador' },
    });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('Panel de administrador')).toBeInTheDocument();
  });
});
