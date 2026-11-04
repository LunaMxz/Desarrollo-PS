// CU-14: reporte de morosidad (administrador).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../src/api/client', () => ({ obtenerMorosidad: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: vi.fn() }));

import MorosidadPage from '../../src/pages/MorosidadPage';
import { obtenerMorosidad } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

const unidades = [
  { unidad_id: 5, unidad_identificador: 'A-101', residente_correo: 'ana@condominio.com', meses_adeudados: 2, adeudo: 3000 },
  { unidad_id: 6, unidad_identificador: 'B-202', residente_correo: null, meses_adeudados: 4, adeudo: 6000.5 },
];

// Muestra el state recibido para comprobar qué manda el botón Cobrar
function Destino() {
  const { state } = useLocation();
  return <p>Registrar pago · unidadId: {String(state?.unidadId)}</p>;
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/admin/morosidad']}>
      <Routes>
        <Route path="/admin/morosidad" element={<MorosidadPage />} />
        <Route path="/admin/pagos/registrar" element={<Destino />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() });
  vi.mocked(obtenerMorosidad).mockResolvedValue({ success: true, unidades });
});

describe('CU-14 MorosidadPage', () => {
  it('muestra carga y luego la tabla ordenada de mayor a menor adeudo', async () => {
    renderPagina();

    expect(screen.getByText('Cargando morosidad…')).toBeInTheDocument();
    await screen.findByRole('table');
    const filas = screen.getAllByRole('row').slice(1);
    expect(within(filas[0]).getByText('B-202')).toBeInTheDocument();
    expect(within(filas[1]).getByText('A-101')).toBeInTheDocument();
    expect(obtenerMorosidad).toHaveBeenCalledWith(undefined);
  });

  it('muestra total por cobrar y número de unidades', async () => {
    renderPagina();

    expect(await screen.findByTestId('total-adeudo')).toHaveTextContent('$9,000.50');
    expect(screen.getByTestId('total-unidades')).toHaveTextContent('2');
  });

  it('muestra "Sin residente activo" cuando no hay residente', async () => {
    renderPagina();

    await screen.findByRole('table');
    expect(screen.getByText('Sin residente activo')).toBeInTheDocument();
    expect(screen.getByText('ana@condominio.com')).toBeInTheDocument();
  });

  it('"Más de 2 meses" consulta con min_meses=3 y "Todas" vuelve a consultar sin filtro', async () => {
    const user = userEvent.setup();
    renderPagina();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Más de 2 meses' }));
    expect(obtenerMorosidad).toHaveBeenLastCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(obtenerMorosidad).toHaveBeenLastCalledWith(undefined);
  });

  it('estado vacío', async () => {
    vi.mocked(obtenerMorosidad).mockResolvedValue({ success: true, unidades: [] });
    renderPagina();

    expect(await screen.findByText('Ninguna unidad tiene adeudos 🎉')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('error y reintento', async () => {
    vi.mocked(obtenerMorosidad)
      .mockResolvedValueOnce({ success: false, error: 'Sin conexión' })
      .mockResolvedValueOnce({ success: true, unidades });
    const user = userEvent.setup();
    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Cobrar navega a Registrar pago enviando unidadId', async () => {
    const user = userEvent.setup();
    renderPagina();
    await screen.findByRole('table');

    const fila = screen.getByText('A-101').closest('tr');
    await user.click(within(fila).getByRole('button', { name: 'Cobrar' }));

    expect(await screen.findByText('Registrar pago · unidadId: 5')).toBeInTheDocument();
  });
});