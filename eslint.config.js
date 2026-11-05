import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Reglas de dependencia entre capas (Dependency Inversion):
//   domain  → no conoce nada de afuera
//   application → depende de puertos, nunca de adaptadores ni frameworks
const frameworkImports = [
  'pg',
  'fastify',
  '@fastify/*',
  'openid-client',
  'astro',
  'react',
  'react-dom',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.astro/**',
      '**/*.d.ts',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**', '**/application/**'],
              message: 'El dominio no depende de capas externas (Dependency Inversion).',
            },
          ],
          paths: frameworkImports.map((name) => ({
            name,
            message: 'El dominio no puede importar frameworks ni drivers.',
          })),
        },
      ],
    },
  },
  {
    files: ['**/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**'],
              message:
                'Los casos de uso dependen de puertos, no de adaptadores (Dependency Inversion).',
            },
          ],
          paths: frameworkImports.map((name) => ({
            name,
            message: 'Los casos de uso no pueden importar frameworks ni drivers.',
          })),
        },
      ],
    },
  },
  {
    // Scripts de línea de comandos y pruebas: imprimen en consola y leen JSON sin tipos en las aserciones.
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/test/**',
      'tools/**',
      '**/src/tools/**',
      '**/migrate-cli.ts',
    ],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Scripts .mjs sin TypeScript: declaran los globales de Node que usan.
    files: ['tools/**/*.mjs', '**/*.config.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
      },
    },
  },
);
