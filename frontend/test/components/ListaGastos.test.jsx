// CU-12 (Parte B): lista de reportes de gasto (residentes y administradores).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/api/transparencia.api', () => ({ listarGastos: vi.fn() }));

import ListaGastos from '../../src/components/ListaGastos';
import { listarGastos } from '../../src/api/transparencia.api';

const API = import.meta.env.VITE_API_URL ?? '';

function archivo(id, mime, nombre) {
  return { id, url_archivo: `/uploads/transparencia/${id}.${nombre.split('.').pop()}`, mime_type: mime, nombre_original: nombre };
}

function publicacion(id, extra = {}) {
  return {
    id,
    titulo: `Reporte ${id}`,
    descripcion: 'Mejoras del jardín',
    fecha_gasto: '2026-10-22T06:00:00.000Z',
    fecha_publicacion: '2026-10-22T18:00:00.000Z',
    total: 3700.5,
    conceptos: [
      {
        id: id * 10,
        nombre: 'Banca de jardín',
        mensaje: 'Se cambió la banca rota',
        monto: 2500,
        categoria: 'mejoras',
        fotos: [archivo(`f${id}a`, 'image/jpeg', 'banca1.jpg'), archivo(`f${id}b`, 'image/png', 'banca2.png')],
        comprobantes: [archivo(`c${id}`, 'application/pdf', 'factura.pdf')],
      },
      {
        id: id * 10 + 1,
        nombre: 'Pintura',
        mensaje: null,
        monto: 1200.5,
        categoria: 'mantenimiento',
        fotos: [],
        comprobantes: [archivo(`t${id}`, 'image/jpeg', 'ticket.jpg')],
      },
    ],
    comprobantes_generales: [],
    ...extra,
  };
}

describe('CU-12 ListaGastos', () => {
  it('muestra carga y después el estado vacío', async () => {
    let resolver;
    listarGastos.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<ListaGastos />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando gastos');
    resolver({ success: true, publicaciones: [], pagina: 1, totalPaginas: 0 });

    expect(await screen.findByText('Aún no hay gastos publicados')).toBeInTheDocument();
    expect(listarGastos).toHaveBeenCalledWith(1, 10);
  });

  it('muestra la tarjeta de reporte con insignia, fecha, descripción y total en pesos', async () => {
    listarGastos.mockResolvedValue({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 1 });
    render(<ListaGastos />);

    const tarjeta = await screen.findByRole('article');
    expect(within(tarjeta).getByText('Reporte de gasto')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('heading', { name: 'Reporte 1' })).toBeInTheDocument();
    // El DATE no se recorre al día anterior por la zona horaria
    expect(tarjeta).toHaveTextContent('22 de octubre de 2026');
    expect(tarjeta).toHaveTextContent('Mejoras del jardín');
    expect(tarjeta).toHaveTextContent('$3,700.50');
  });

  it('lista los conceptos con nombre, categoría, monto y mensaje', async () => {
    listarGastos.mockResolvedValue({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 1 });
    render(<ListaGastos />);

    const [banca, pintura] = within(await screen.findByRole('article')).getAllByRole('listitem')
      .filter((li) => li.classList.contains('gasto-concepto'));
    expect(banca).toHaveTextContent('Banca de jardín');
    expect(banca).toHaveTextContent('Mejoras');
    expect(banca).toHaveTextContent('$2,500.00');
    expect(banca).toHaveTextContent('Se cambió la banca rota');
    expect(pintura).toHaveTextContent('Mantenimiento');
    expect(pintura).toHaveTextContent('$1,200.50');
  });

  it('los comprobantes abren el archivo en otra pestaña y distinguen PDF de imagen', async () => {
    listarGastos.mockResolvedValue({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 1 });
    render(<ListaGastos />);

    const facturas = await screen.findAllByRole('link', { name: /Ver factura/ });
    expect(facturas).toHaveLength(2);
    expect(facturas[0]).toHaveAttribute('href', `${API}/uploads/transparencia/c1.pdf`);
    expect(facturas[0]).toHaveAttribute('target', '_blank');
    expect(facturas[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(facturas[0]).toHaveTextContent('PDF');
    expect(facturas[1]).toHaveTextContent('Imagen');
  });

  it('muestra "Comprobantes generales" solo cuando existen', async () => {
    listarGastos.mockResolvedValue({
      success: true,
      publicaciones: [publicacion(1), publicacion(2, { comprobantes_generales: [archivo('g2', 'application/pdf', 'ticket-general.pdf')] })],
      pagina: 1,
      totalPaginas: 1,
    });
    render(<ListaGastos />);

    const [primera, segunda] = await screen.findAllByRole('article');
    expect(primera).not.toHaveTextContent('Comprobantes generales');
    expect(segunda).toHaveTextContent('Comprobantes generales');
    expect(within(segunda).getByRole('link', { name: /Ver comprobante/ }))
      .toHaveAttribute('href', `${API}/uploads/transparencia/g2.pdf`);
  });

  it('al hacer clic en una miniatura abre la foto en grande y se puede navegar y cerrar', async () => {
    listarGastos.mockResolvedValue({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 1 });
    const user = userEvent.setup({ delay: null });
    render(<ListaGastos />);

    await user.click(await screen.findByRole('button', { name: 'Ver foto 1 de Banca de jardín en grande' }));
    const visor = screen.getByRole('dialog');
    expect(within(visor).getByRole('img')).toHaveAttribute('src', `${API}/uploads/transparencia/f1a.jpg`);
    expect(visor).toHaveTextContent('1 de 2');

    await user.click(within(visor).getByRole('button', { name: 'Foto siguiente' }));
    expect(within(visor).getByRole('img')).toHaveAttribute('src', `${API}/uploads/transparencia/f1b.png`);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Cargar más" agrega la siguiente página y desaparece en la última', async () => {
    listarGastos
      .mockResolvedValueOnce({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 2 })
      .mockResolvedValueOnce({ success: true, publicaciones: [publicacion(2)], pagina: 2, totalPaginas: 2 });
    const user = userEvent.setup({ delay: null });
    render(<ListaGastos />);

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByRole('heading', { name: 'Reporte 2' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(listarGastos).toHaveBeenLastCalledWith(2, 10);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    listarGastos
      .mockResolvedValueOnce({ success: false, error: 'No se pudo conectar con el servidor.' })
      .mockResolvedValueOnce({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 1 });
    const user = userEvent.setup({ delay: null });
    render(<ListaGastos />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Reporte 1' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si falla "Cargar más" conserva lo ya mostrado', async () => {
    listarGastos
      .mockResolvedValueOnce({ success: true, publicaciones: [publicacion(1)], pagina: 1, totalPaginas: 2 })
      .mockResolvedValueOnce({ success: false, error: 'El servidor tuvo un problema.' });
    const user = userEvent.setup({ delay: null });
    render(<ListaGastos />);

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor tuvo un problema.');
    expect(screen.getByRole('heading', { name: 'Reporte 1' })).toBeInTheDocument();
  });
});
