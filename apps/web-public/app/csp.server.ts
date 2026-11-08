// CSP del HTML del servidor (FE-04, SEC-13). React Router escribe unos pocos scripts en línea (contexto de hidratación
// y restauración de scroll); se autorizan por su hash sha256 en vez de con `'unsafe-inline'` o un nonce, para que el CDN
// pueda cachear la página tal cual.
import { createHash } from 'node:crypto';

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/giu;

export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const [, body = ''] of html.matchAll(INLINE_SCRIPT)) {
    if (body.trim() === '') continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

export function contentSecurityPolicy(html: string, options: { dev: boolean }): string {
  const scripts = ["'self'", ...inlineScriptHashes(html)].join(' ');
  return [
    "default-src 'none'",
    `script-src ${scripts}`,
    // En desarrollo Vite inyecta los estilos con <style> y recarga por WebSocket.
    options.dev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    options.dev ? "connect-src 'self' ws:" : "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/**
 * Cabeceras finales del documento HTML. Una respuesta de error nunca se cachea ni lleva claves de purga: si no, el CDN
 * serviría un 404 o un 502 con las cabeceras del loader raíz aunque la página ya exista o la API se haya recuperado.
 */
export function documentHeaders(headers: Headers, page: { status: number; html: string; dev: boolean }): Headers {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', contentSecurityPolicy(page.html, { dev: page.dev }));
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (page.status >= 400) {
    headers.set('Cache-Control', 'no-store');
    headers.delete('Surrogate-Key');
  }
  return headers;
}
