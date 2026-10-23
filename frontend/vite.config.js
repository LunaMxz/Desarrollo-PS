import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{js,jsx}'],
    setupFiles: ['test/setup.js'],
    // Cada test arranca con los mocks limpios (sin llamadas ni implementaciones previas)
    mockReset: true,
    // Las pruebas que simulan escritura con user-event pueden pasar de 5 s (el valor por defecto)
    // en máquinas lentas o cargadas; 15 s evita fallos falsos sin ocultar pruebas colgadas.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
      reporter: ['text', 'html', 'lcov'],
      // Mínimo acordado por el equipo: si baja de aquí, `npm run test:coverage` falla
      thresholds: { statements: 60, branches: 60, functions: 60, lines: 60 },
    },
  },
});
