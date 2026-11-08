// Reglas de calidad (spec 7.1) y fronteras de capas (spec 3.4).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Librerías de I/O y frameworks: solo pueden usarse en infrastructure/, interfaces/ y la raíz de composición.
const frameworks = ['pg', 'kysely', 'fastify', '@fastify/*', 'jose', 'undici', 'ioredis', '@aws-sdk/*', 'kafkajs'];

const forbid = (groups, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: groups, message }] }],
});

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      'contracts/dist/**',
      'contracts/docs/**',
      '**/generated/**',
      'coverage/**',
      '**/build/**',
      '**/dist/**',
      '**/.react-router/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: { globals: globals.node },
    rules: {
      complexity: ['error', 10],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/src/domain/**/*.ts'],
    rules: {
      ...forbid(
        [...frameworks, '**/application/**', '**/infrastructure/**', '**/interfaces/**'],
        'domain/ solo puede importar shared-kernel (spec 3.4).',
      ),
      'no-restricted-globals': ['error', { name: 'process', message: 'domain/ no lee process.env (spec 3.4).' }],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Inyecta el reloj del shared-kernel (spec 3.4).' },
      ],
    },
  },
  {
    files: ['**/src/application/**/*.ts'],
    rules: {
      ...forbid(
        [...frameworks, '**/infrastructure/**', '**/interfaces/**'],
        'application/ depende de puertos, no de adaptadores ni frameworks (spec 3.4).',
      ),
      'no-restricted-globals': ['error', { name: 'process', message: 'application/ no lee process.env (spec 3.4).' }],
    },
  },
  {
    files: ['**/src/interfaces/**/*.ts'],
    rules: forbid(
      ['pg', 'kysely', '**/infrastructure/**'],
      'interfaces/ traduce HTTP a casos de uso; sin SQL (spec 3.4).',
    ),
  },
  {
    files: ['**/src/infrastructure/**/*.ts'],
    rules: forbid(['**/interfaces/**'], 'infrastructure/ no importa interfaces/ (spec 3.4).'),
  },
  // Frontends (spec 3.7): React Router es la única capa de datos (FE-01) y nada de APIs `unstable_` (FE-03). Solo
  // hablan con las APIs por `@incuba/api-client`, nunca con el código de los servicios.
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...frameworks, '@incuba/http-kit', '@incuba/shared-kernel', '**/services/**'],
              message: 'Los frontends solo usan las APIs con @incuba/api-client (spec 3.2).',
            },
            {
              group: ['@tanstack/*', 'swr', 'redux', '@reduxjs/*', 'axios'],
              message: 'React Router es la única capa de datos del frontend (FE-01).',
            },
            {
              group: ['react-router', 'react-router/*', '@react-router/*'],
              importNamePattern: '^unstable_',
              message: 'Sin APIs inestables de React Router (FE-03).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web-public/**/*.{ts,tsx}', 'apps/*/vite.config.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
