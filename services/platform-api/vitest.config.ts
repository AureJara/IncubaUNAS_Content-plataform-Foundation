import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['../../tools/vitest-env.ts'],
    testTimeout: 30_000,
    // Los archivos de integración comparten la misma base: se ejecutan uno a la vez.
    fileParallelism: false,
  },
});
