// CSP por hash, enlaces seguros, cabeceras de caché y fechas de eventos.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cacheHeaders, mergeSurrogateKeys, routeHeaders } from '../app/cache.ts';
import { contentSecurityPolicy, documentHeaders, inlineScriptHashes } from '../app/csp.server.ts';
import { formatRange } from '../app/events.ts';
import { safeHref } from '../app/links.ts';
import { pagePath } from '../app/routes/page.tsx';

const sha = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

describe('CSP', () => {
  const html =
    '<html><head><script type="module" src="/assets/entry.js"></script></head><body>' +
    '<script>window.__ctx = {"a":1};</script><script type="module">import "/assets/x.js";</script>' +
    '<script>window.__ctx = {"a":1};</script><script></script></body></html>';

  it('autoriza cada script en línea por su hash, una vez, y no los que tienen src', () => {
    expect(inlineScriptHashes(html)).toEqual([sha('window.__ctx = {"a":1};'), sha('import "/assets/x.js";')]);
  });

  it('en producción no permite nada en línea ni de otro origen', () => {
    const policy = contentSecurityPolicy(html, { dev: false });
    expect(policy).toContain(`script-src 'self' ${sha('window.__ctx = {"a":1};')}`);
    expect(policy).toContain("style-src 'self';");
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe');
    expect(policy).not.toContain('ws:');
  });

  it('en desarrollo relaja solo estilos y el WebSocket de recarga', () => {
    const policy = contentSecurityPolicy(html, { dev: true });
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' ws:");
    expect(policy).not.toMatch(/script-src[^;]*unsafe/u);
  });
});

describe('cabeceras del documento', () => {
  const cacheable = () => new Headers({ 'Cache-Control': 'public, max-age=60', 'Surrogate-Key': 'site:a page:1' });

  it('una página correcta conserva su caché y suma la CSP y las cabeceras de seguridad', () => {
    const headers = documentHeaders(cacheable(), { status: 200, html: '<p></p>', dev: false });
    expect(headers.get('cache-control')).toBe('public, max-age=60');
    expect(headers.get('surrogate-key')).toBe('site:a page:1');
    expect(headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });

  it.each([404, 500, 502])('un %i no se cachea ni lleva claves de purga', (status) => {
    const headers = documentHeaders(cacheable(), { status, html: '<p></p>', dev: false });
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('surrogate-key')).toBeNull();
    expect(headers.get('content-security-policy')).toContain("default-src 'none'");
  });
});

describe('safeHref', () => {
  it.each([
    ['/eventos', '/eventos'],
    ['/', '/'],
    ['https://example.org/a?b=1', 'https://example.org/a?b=1'],
  ])('acepta %s', (href, expected) => {
    expect(safeHref(href)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://example.org',
    '//evil.example',
    '/\\evil.example',
    'https://user:pass@example.org',
    'https://exa mple.org',
    'eventos',
    '',
    undefined,
  ])('rechaza %s', (href) => {
    expect(safeHref(href)).toBeUndefined();
  });
});

describe('caché', () => {
  it('une los Surrogate-Key sin repetir', () => {
    expect(mergeSurrogateKeys('site:a page:1', null, 'page:1  event:2', undefined)).toBe('site:a page:1 event:2');
  });

  it('toma el Cache-Control del recurso principal y suma las claves', () => {
    const page = new Response(null, { headers: { 'cache-control': 'public, max-age=60', 'surrogate-key': 'page:1' } });
    const events = new Response(null, { headers: { 'cache-control': 'public, max-age=30', 'surrogate-key': 'ev:1' } });
    const headers = cacheHeaders([page, events], ['site:a']);
    expect(headers.get('cache-control')).toBe('public, max-age=60');
    expect(headers.get('surrogate-key')).toBe('site:a page:1 ev:1');
  });

  it('sin Cache-Control de la API no cachea', () => {
    expect(cacheHeaders([new Response(null)]).get('cache-control')).toBe('no-store');
  });

  it('la hoja manda en Cache-Control y un error nunca se cachea', () => {
    const parentHeaders = new Headers({ 'cache-control': 'public, max-age=300', 'surrogate-key': 'site:a' });
    const loaderHeaders = new Headers({ 'cache-control': 'public, max-age=60', 'surrogate-key': 'page:1' });
    const ok = routeHeaders({ parentHeaders, loaderHeaders, errorHeaders: undefined });
    expect(ok.get('cache-control')).toBe('public, max-age=60');
    expect(ok.get('surrogate-key')).toBe('site:a page:1');
    const failed = routeHeaders({ parentHeaders, loaderHeaders, errorHeaders: new Headers() });
    expect(failed.get('cache-control')).toBe('no-store');
    expect(failed.get('surrogate-key')).toBeNull();
  });
});

describe('fechas de eventos', () => {
  it('formatea en la zona horaria del evento', () => {
    const text = formatRange('2026-12-01T14:00:00Z', '2026-12-01T16:00:00Z', 'America/Lima', 'es-PE');
    expect(text).toContain('9:00');
    expect(text).toContain('diciembre');
  });

  it('con una zona inválida cae a UTC en vez de romper la página', () => {
    // 14:00–16:00 UTC; es-PE usa el reloj de 12 horas.
    const text = formatRange('2026-12-01T14:00:00Z', '2026-12-01T16:00:00Z', 'Zona/Inexistente', 'es-PE');
    expect(text).toMatch(/2:00\D+4:00\s*p\.\s*m\./u);
  });
});

describe('pagePath', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['guia', '/guia'],
    ['guia/', '/guia'],
    ['programas/agtech', '/programas/agtech'],
  ])('%s → %s', (splat, expected) => {
    expect(pagePath(splat)).toBe(expected);
  });

  it.each(['Guia', 'guia//x', '../etc', 'a b', 'a%2Fb'])('rechaza %s sin llamar a la API', (splat) => {
    expect(pagePath(splat)).toBeNull();
  });
});
