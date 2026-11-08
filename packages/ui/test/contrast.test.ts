// Los pares de texto y fondo que usan el sitio y el shell cumplen WCAG 2.2 AA (F0-15, PF-045): 4.5:1 para texto normal.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
const colors = new Map([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function token(name: string): string {
  const value = colors.get(name);
  if (!value) throw new Error(`Falta el token --color-${name}`);
  return value;
}

// [texto, fondo]: los pares que aparecen en los componentes.
const PAIRS: [string, string][] = [
  ['on-surface', 'surface'],
  ['on-surface', 'surface-container-lowest'],
  ['on-surface', 'secondary-container'],
  ['on-surface-variant', 'surface'],
  ['secondary', 'surface'],
  ['secondary', 'surface-container-lowest'],
  ['secondary', 'surface-container-low'],
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['primary', 'surface-container-lowest'],
  ['primary', 'primary-fixed'],
  ['on-secondary-container', 'secondary-container'],
  ['tertiary', 'surface-container-lowest'],
  ['error', 'surface-container-lowest'],
  ['on-error-container', 'error-container'],
  ['inverse-on-surface', 'inverse-surface'],
];

describe('tokens de color', () => {
  it('lee los colores del tema', () => {
    expect(colors.size).toBeGreaterThan(40);
  });

  it.each(PAIRS)('%s sobre %s cumple AA (4.5:1)', (text, background) => {
    expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(4.5);
  });
});
