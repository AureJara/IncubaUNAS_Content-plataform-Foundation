import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { setupFiles: ['../../tools/vitest-env.ts'], testTimeout: 20_000 },
});
