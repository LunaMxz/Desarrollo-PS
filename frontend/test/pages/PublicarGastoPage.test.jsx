// CU-12 (Parte A): formulario del administrador para publicar un gasto.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/transparencia.api', () => ({ publicarGasto: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import PublicarGastoPage from '../../src/pages/PublicarGastoPage';
import { publicarGasto } from '../../src/api/transparencia.api';
import { renderPagina } from '../helpers/render';

// jsdom no implementa las vistas previas de archivos ni el scroll
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
  URL.revokeObjectURL = vi.fn();
  window.scrollTo = vi.fn();
});

function archivo(nombre, tipo, bytes = 1024) {
  const f = new File(['contenido'], nombre, { type: tipo, lastModified: nombre.length });
  if (bytes !== undefined) Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

let user;
beforeEach(() => {
  // applyAccept: false para que lleguen al formulario también los archivos inválidos
  user = userEvent.setup({ delay: null, applyAccept: false });
});

const concepto = (n) => screen.getByRole('group', { name: `Concepto ${n}` });

async function llenarConcepto(n, { nombre, monto, categoria }) {
  const c = within(concepto(n));
  if (nombre) await user.type(c.getByLabelText(/Nombre del concepto/), nombre);
  if (monto) await user.type(c.getByLabelText(/Monto/), monto);
  if (categoria) await user.selectOptions(c.getByLabelText('Categoría'), categoria);
}

function publicar() {
  return user.click(screen.getByRole('button', { name: 'Publicar gasto' }));
}

describe('CU-12 PublicarGastoPage', () => {
  it('valida título y conceptos antes de enviar', async () => {
    renderPagina(<PublicarGastoPage />);

    await publicar();

    expect(screen.getByText('Escribe un título para el gasto.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el nombre del concepto.')).toBeInTheDocument();
    expect(screen.getByText('El monto debe ser mayor a $0.')).toBeInTheDocument();
    expect(screen.getByText('Revisa los campos marcados antes de publicar.')).toBeInTheDocument();
    expect(publicarGasto).not.toHaveBeenCalled();
  });

  it('muestra el total en vivo y permite agregar y quitar conceptos (siempre queda 1)', async () => {
    renderPagina(<PublicarGastoPage />);

    expect(screen.queryByRole('button', { name: 'Quitar concepto' })).not.toBeInTheDocument();
    await llenarConcepto(1, { monto: '2500' });
    await user.click(screen.getByRole('button', { name: '+ Agregar otro concepto' }));
    await llenarConcepto(2, { monto: '1200.50' });

    expect(screen.getByTestId('total-gasto')).toHaveTextContent('$3,700.50');

    await user.click(within(concepto(2)).getByRole('button', { name: 'Quitar concepto' }));

    expect(screen.queryByRole('group', { name: 'Concepto 2' })).not.toBeInTheDocument();
    expect(screen.getByTestId('total-gasto')).toHaveTextContent('$2,500.00');
    expect(screen.queryByRole('button', { name: 'Quitar concepto' })).not.toBeInTheDocument();
  });

  it('el monto solo acepta números con máximo 2 decimales', async () => {
    renderPagina(<PublicarGastoPage />);

    await user.type(within(concepto(1)).getByLabelText(/Monto/), 'a1,2.345');

    expect(within(concepto(1)).getByLabelText(/Monto/)).toHaveValue('12.34');
  });

  it('muestra miniaturas de las fotos y rechaza archivos inválidos o de más de 5 MB', async () => {
    renderPagina(<PublicarGastoPage />);
    const inputFotos = concepto(1).querySelector('input[type="file"][accept^="image"]');

    await user.upload(inputFotos, [
      archivo('banca.png', 'image/png'),
      archivo('virus.exe', 'application/x-msdownload'),
      archivo('grande.jpg', 'image/jpeg', 6 * 1024 * 1024),
    ]);

    const c = within(concepto(1));
    expect(c.getByRole('img', { name: 'banca.png' })).toHaveAttribute('src', 'blob:vista-previa');
    expect(c.queryByRole('img', { name: 'virus.exe' })).not.toBeInTheDocument();
    expect(c.getByRole('alert')).toHaveTextContent('«virus.exe» no es válido');
    expect(c.getByRole('alert')).toHaveTextContent('«grande.jpg» pesa 6.0 MB y el máximo es 5 MB.');

    await user.click(c.getByRole('button', { name: 'Quitar banca.png' }));
    expect(c.queryByRole('img', { name: 'banca.png' })).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista-previa');
  });

  it('arma el FormData del contrato, muestra el progreso y limpia el formulario al publicar', async () => {
    let terminar;
    vi.mocked(publicarGasto).mockImplementation((_formData, onProgress) => {
      onProgress(40);
      return new Promise((r) => { terminar = r; });
    });
    renderPagina(<PublicarGastoPage />);

    await user.type(screen.getByLabelText(/Título/), 'Mejoras del jardín');
    await user.type(screen.getByLabelText('Descripción'), 'Octubre');
    await llenarConcepto(1, { nombre: 'Banca', monto: '2500', categoria: 'mejoras' });
    await user.type(within(concepto(1)).getByLabelText(/Mensaje para los residentes/), 'Junto a los juegos');
    await user.upload(concepto(1).querySelector('input[accept^="image"]'), archivo('banca.png', 'image/png'));
    await user.upload(concepto(1).querySelector('input[accept*="pdf"]'), archivo('factura.pdf', 'application/pdf'));
    await user.click(screen.getByRole('button', { name: '+ Agregar otro concepto' }));
    await llenarConcepto(2, { nombre: 'Pintura', monto: '1200.5' });
    const inputGenerales = screen.getByRole('group', { name: 'Comprobantes generales' }).querySelector('input[type="file"]');
    await user.upload(inputGenerales, archivo('general.pdf', 'application/pdf'));

    await publicar();

    // Mientras sube: barra de progreso y botón deshabilitado
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('button', { name: 'Publicando… 40%' })).toBeDisabled();

    const formData = vi.mocked(publicarGasto).mock.calls[0][0];
    expect(formData.get('titulo')).toBe('Mejoras del jardín');
    expect(formData.get('descripcion')).toBe('Octubre');
    expect(formData.get('fecha_gasto')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Los archivos no van dentro del JSON de conceptos
    expect(JSON.parse(formData.get('conceptos'))).toEqual([
      { nombre: 'Banca', mensaje: 'Junto a los juegos', monto: 2500, categoria: 'mejoras' },
      { nombre: 'Pintura', mensaje: '', monto: 1200.5, categoria: 'otros' },
    ]);
    expect(formData.getAll('fotos_0').map((f) => f.name)).toEqual(['banca.png']);
    expect(formData.getAll('comprobantes_0').map((f) => f.name)).toEqual(['factura.pdf']);
    expect(formData.getAll('fotos_1')).toEqual([]);
    expect(formData.getAll('comprobantes_generales').map((f) => f.name)).toEqual(['general.pdf']);

    terminar({ success: true, mensaje: 'Publicación de transparencia creada exitosamente' });

    expect(await screen.findByRole('status')).toHaveTextContent('Publicación de transparencia creada exitosamente');
    expect(screen.getByLabelText(/Título/)).toHaveValue('');
    expect(screen.queryByRole('group', { name: 'Concepto 2' })).not.toBeInTheDocument();
    expect(screen.getByTestId('total-gasto')).toHaveTextContent('$0.00');
  });

  it('si falla el envío muestra el error y conserva lo capturado', async () => {
    vi.mocked(publicarGasto).mockResolvedValue({ success: false, error: 'No se pudo conectar con el servidor.' });
    renderPagina(<PublicarGastoPage />);

    await user.type(screen.getByLabelText(/Título/), 'Mejoras del jardín');
    await llenarConcepto(1, { nombre: 'Banca', monto: '2500' });
    await publicar();

    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toHaveValue('Mejoras del jardín');
    expect(within(concepto(1)).getByLabelText(/Monto/)).toHaveValue('2500');
    expect(screen.getByRole('button', { name: 'Publicar gasto' })).toBeEnabled();
  });

  it('no permite más de 20 archivos por publicación', async () => {
    renderPagina(<PublicarGastoPage />);

    await user.type(screen.getByLabelText(/Título/), 'Muchas fotos');
    await llenarConcepto(1, { nombre: 'Banca', monto: '10' });
    const fotos = Array.from({ length: 21 }, (_, i) => archivo(`foto${String(i).padStart(2, '0')}.png`, 'image/png'));
    await user.upload(concepto(1).querySelector('input[accept^="image"]'), fotos);
    await publicar();

    expect(screen.getByText('Máximo 20 archivos por publicación.')).toBeInTheDocument();
    expect(publicarGasto).not.toHaveBeenCalled();
  });
});
