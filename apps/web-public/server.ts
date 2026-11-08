// Servidor de producción del sitio público: archivos compilados y SSR de React Router. Va detrás del CDN, que respeta
// el `Cache-Control` y purga por `Surrogate-Key` (FE-05).
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { fileURLToPath } from 'node:url';
import type { ServerBuild } from 'react-router';

const BUILD_URL = new URL('./build/server/index.js', import.meta.url).href;
const CLIENT_DIR = fileURLToPath(new URL('./build/client', import.meta.url));

const port = Number(process.env['WEB_PUBLIC_PORT'] ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WEB_PUBLIC_PORT inválido.');

const app = express();
app.disable('x-powered-by');

const nosniff = (response: express.Response) => response.setHeader('X-Content-Type-Options', 'nosniff');
// Los archivos de /assets llevan hash en el nombre: se cachean un año.
app.use('/assets', express.static(`${CLIENT_DIR}/assets`, { immutable: true, maxAge: '1y', setHeaders: nosniff }));
app.use(express.static(CLIENT_DIR, { maxAge: '1h', index: false, setHeaders: nosniff }));
app.use(createRequestHandler({ build: () => import(BUILD_URL) as Promise<ServerBuild> }));

app.listen(port, () => {
  console.log(`web-public escuchando en http://localhost:${port}`);
});
