import { defineMiddleware } from 'astro:middleware';
import { MEDIA_BASE_URL } from 'astro:env/server';

const MEDIA_BASE = MEDIA_BASE_URL ?? '';

// CSP restrictiva: sin scripts, fuentes, hojas de estilo ni imágenes de terceros (todo se sirve desde este
// sitio; las imágenes de contenido, desde MEDIA_BASE_URL). `style-src 'unsafe-inline'` es necesario solo para
// las variables CSS del tema, que se validan antes de emitirse (ver lib/theme.ts).
const CSP = [
  "default-src 'self'",
  `img-src 'self' data: ${MEDIA_BASE}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('content-security-policy', CSP);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return response;
});
