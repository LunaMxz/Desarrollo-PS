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
  },
});
