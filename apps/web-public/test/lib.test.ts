import { describe, expect, it } from 'vitest';
import {
  formatRange,
  formatShortDate,
  formatTime,
  pageTitle,
  safeHref,
} from '../src/lib/format.js';
import { renderMarkdown } from '../src/lib/markdown.js';
import { themeStyle } from '../src/lib/theme.js';

describe('renderMarkdown (defensa en profundidad contra XSS)', () => {
  it('renderiza Markdown normal', () => {
    expect(renderMarkdown('## Título\n\nTexto **fuerte**')).toContain('<h2>Título</h2>');
    expect(renderMarkdown('Texto **fuerte**')).toContain('<strong>fuerte</strong>');
  });

  it.each([
    ['script', 'Hola <script>alert(1)</script>'],
    ['evento inline', '<img src=x onerror="alert(1)">'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['enlace javascript', '[clic](javascript:alert(1))'],
    ['enlace data', '[clic](data:text/html;base64,PHNjcmlwdD4=)'],
  ])('elimina %s', (_name, input) => {
    const html = renderMarkdown(input);
    expect(html).not.toMatch(/<script|<iframe|onerror|javascript:|data:text/i);
  });

  it('los enlaces externos llevan rel="noopener noreferrer"', () => {
    expect(renderMarkdown('[sitio](https://example.org)')).toContain('rel="noopener noreferrer"');
  });
});

describe('themeStyle', () => {
  it('usa el color de marca y el redondeo válidos del tema', () => {
    const style = themeStyle({ color_primary: '#0b5fff', radius: 'lg' } as never);
    expect(style).toContain('--brand-primary:#0b5fff');
    expect(style).toContain('--brand-radius:16px');
    // Tailwind 3 necesita la tripleta RGB para poder aplicar transparencias (`bg-primary/10`).
    expect(style).toContain('--brand-primary-rgb:11 95 255');
    // Con otra marca, el tono "hover" se deriva de ella (15 % más cerca del blanco) en lugar de quedarse en el azul del diseño.
    expect(style).toContain('--brand-primary-container-rgb:48 119 255');
  });

  it('con la marca del diseño conserva su tono exacto de contenedor', () => {
    const style = themeStyle({ color_primary: '#005bbf' } as never);
    expect(style).toContain('--brand-primary-rgb:0 91 191');
    expect(style).toContain('--brand-primary-container-rgb:26 115 232'); // #1a73e8
  });

  it('acepta el color en mayúsculas', () => {
    expect(themeStyle({ color_primary: '#005BBF' } as never)).toContain(
      '--brand-primary-container-rgb:26 115 232',
    );
  });

  it('descarta valores que no son colores o que intentan inyectar CSS', () => {
    const style = themeStyle({
      color_primary: 'red; background:url(https://evil.example)',
      radius: '9px; position:fixed',
    } as never);
    expect(style).not.toMatch(/evil|javascript|position/);
    expect(style).toContain('--brand-primary:#005bbf'); // respaldo seguro
    expect(style).toContain('--brand-radius:8px');
  });

  it('sin tema usa los valores del diseño', () => {
    const style = themeStyle(undefined);
    expect(style).toContain('--brand-primary:#005bbf');
    expect(style).toContain('--brand-radius:8px');
  });

  it('no usa nombres que Tailwind genera por su cuenta (--color-*, --radius-*)', () => {
    expect(themeStyle(undefined)).not.toMatch(/--color-|--radius-/);
  });
});

describe('formato de fechas y enlaces', () => {
  it('muestra la hora en la zona horaria del evento, no en la del servidor', () => {
    expect(formatTime('2026-12-01T15:00:00Z', 'America/Lima', 'es-PE')).toMatch(/10:00/);
    expect(formatTime('2026-12-01T15:00:00Z', 'Asia/Tokyo', 'es-PE')).toMatch(/12:00|00:00/);
  });

  it('agrupa un evento de un solo día y separa uno de varios', () => {
    expect(
      formatRange('2026-12-01T14:00:00Z', '2026-12-01T20:00:00Z', 'America/Lima', 'es-PE'),
    ).toContain(',');
    expect(
      formatRange('2026-12-01T14:00:00Z', '2026-12-03T20:00:00Z', 'America/Lima', 'es-PE'),
    ).toContain('–');
  });

  it('solo deja pasar rutas relativas y HTTPS', () => {
    expect(safeHref('/eventos')).toBe('/eventos');
    expect(safeHref('https://example.org')).toBe('https://example.org');
    for (const bad of [
      '//evil.example',
      'javascript:alert(1)',
      'http://inseguro.example',
      'data:text/html,x',
      undefined,
      42,
    ]) {
      expect(safeHref(bad)).toBe('#');
    }
  });

  it('compone el título de pestaña sin repetir el nombre del sitio', () => {
    expect(pageTitle('Eventos', 'IncubaUNAS')).toBe('Eventos · IncubaUNAS');
    expect(pageTitle('IncubaUNAS', 'IncubaUNAS')).toBe('IncubaUNAS');
  });

  it('la fecha corta usa la zona horaria del evento', () => {
    // 2026-12-01 03:00 UTC es 30 de noviembre en Lima y 1 de diciembre en Tokio.
    expect(formatShortDate('2026-12-01T03:00:00Z', 'America/Lima', 'es-PE')).toMatch(/^30 NOV/);
    expect(formatShortDate('2026-12-01T03:00:00Z', 'Asia/Tokyo', 'es-PE')).toMatch(/^01 DIC/);
  });
});
