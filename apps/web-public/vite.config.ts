// Sitio público: React Router en modo framework con SSR. Lee la Public Read API desde el servidor (CONTENT_PUBLIC_URL);
// el navegador solo habla con este mismo origen.
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function port(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`Puerto inválido: ${value}`);
  return parsed;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, ['CONTENT_PUBLIC_URL', 'WEB_PUBLIC_PORT']);
  // El SSR de desarrollo corre en este proceso; solo se copia si existe (asignar undefined guardaría "undefined").
  const contentPublicUrl = env['CONTENT_PUBLIC_URL'];
  if (contentPublicUrl && !process.env['CONTENT_PUBLIC_URL']) process.env['CONTENT_PUBLIC_URL'] = contentPublicUrl;
  const webPort = port(env['WEB_PUBLIC_PORT'], 3000);
  return {
    plugins: [tailwindcss(), reactRouter()],
    // Sin data: URIs: la CSP no los permite.
    build: { assetsInlineLimit: 0 },
    server: { port: webPort, strictPort: true },
  };
});
