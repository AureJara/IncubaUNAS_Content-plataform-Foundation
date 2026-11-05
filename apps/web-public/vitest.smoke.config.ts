import { defineConfig } from 'vitest/config';

// Pruebas de humo del sitio compilado: `pnpm --filter @incubaunas/web-public test:smoke` (compila primero).
export default defineConfig({
  test: {
    include: ['test/smoke/**/*.smoke.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
