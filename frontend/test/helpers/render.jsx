import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Renderiza una página dentro de un router de memoria.
// Las rutas extra permiten comprobar a dónde navega la página (ej. tras el login).
export function renderPagina(ui, { ruta = '/', rutasExtra = {} } = {}) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path={ruta} element={ui} />
        {Object.entries(rutasExtra).map(([path, texto]) => (
          <Route key={path} path={path} element={<p>{texto}</p>} />
        ))}
      </Routes>
    </MemoryRouter>
  );
}
