import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La CSP del sitio (src/middleware.ts) solo admite recursos propios. Esta prueba falla antes que el
 * navegador: cualquier `<img>`, hoja de estilo o fuente de un tercero dejaría la página rota en producción
 * (y expondría a los visitantes). Los diseños de Stitch traen URLs de googleusercontent y Google Fonts.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(astro|css|ts)$/.test(name) && !name.endsWith('.generated.ts') ? [path] : [];
  });
}

const EXTERNAL_RESOURCE =
  /(?:src|href)=["']https?:\/\/|url\(\s*["']?https?:\/\/|@import\s+["']?https?:\/\//;

describe('recursos de terceros', () => {
  const files = sourceFiles(join(import.meta.dirname, '..', 'src'));

  it('encuentra las fuentes que debe revisar', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [file.split('src')[1]!, file] as const))(
    '%s no carga imágenes, estilos ni fuentes externas',
    (_name, file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(EXTERNAL_RESOURCE);
    },
  );

  it('ninguna página usa manejadores de eventos en línea (la CSP los bloquea)', () => {
    for (const file of files.filter((f) => f.endsWith('.astro'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\son[a-z]+=["']/);
    }
  });
});
