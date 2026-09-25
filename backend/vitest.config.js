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
    },
  },
});
