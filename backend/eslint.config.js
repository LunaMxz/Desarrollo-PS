import js from '@eslint/js';
import globals from 'globals';

// Configuración mínima: reglas recomendadas de ESLint. Lo que es solo estilo
// o limpieza queda como "warn" para no bloquear el CI.
export default [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$', varsIgnorePattern: '^_' }],
    },
  },
];
