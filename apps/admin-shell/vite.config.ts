import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// En desarrollo las APIs se sirven bajo el mismo origen que el panel (proxy), igual que detrás del
// gateway en producción: así las cookies de sesión son de primera parte y no hace falta CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/platform': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: false,
  },
});
