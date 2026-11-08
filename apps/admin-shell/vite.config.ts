// Shell administrativo: SPA de React Router en modo datos (spec 3.7). En local, Vite reenvía al gateway las rutas de la
// API para que el shell y la API compartan origen, igual que cuando el gateway sirva los archivos compilados.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Prefijos que atiende el gateway (auth.yaml, platform.yaml y cms.yaml).
const GATEWAY_PREFIXES = ['/auth/', '/platform/v1/', '/cms/v1/', '/.well-known/'];

// CSP del shell compilado (SEC-13): sin scripts, estilos ni manejadores en línea, y nada de otro origen.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

function port(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`Puerto inválido: ${value}`);
  return parsed;
}

function gatewayProxy(gatewayUrl: string | undefined): Record<string, ProxyOptions> {
  if (!gatewayUrl) throw new Error('Falta GATEWAY_URL: copia .env.example a .env.');
  const target = new URL(gatewayUrl).origin;
  return Object.fromEntries(GATEWAY_PREFIXES.map((prefix) => [prefix, { target, changeOrigin: false }]));
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, repoRoot, ['GATEWAY_URL', 'ADMIN_SHELL_PORT']);
  const proxy = command === 'serve' ? gatewayProxy(env['GATEWAY_URL']) : {};
  const shellPort = port(env['ADMIN_SHELL_PORT'], 5173);
  return {
    plugins: [react(), tailwindcss()],
    // Sin data: URIs: la CSP no los permite.
    build: { assetsInlineLimit: 0 },
    server: { port: shellPort, strictPort: true, proxy },
    preview: { port: shellPort, strictPort: true, proxy, headers: SECURITY_HEADERS },
  };
});
