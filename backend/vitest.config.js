import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    setupFiles: ['test/setup.js'],
    // Cada test arranca con los mocks limpios (sin llamadas ni implementaciones previas)
    mockReset: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/config/db.js'],
      reporter: ['text', 'html', 'lcov'],
      // Mínimo acordado por el equipo: si baja de aquí, `npm run test:coverage` falla
      thresholds: { statements: 60, branches: 60, functions: 60, lines: 60 },
    },
  },
});
