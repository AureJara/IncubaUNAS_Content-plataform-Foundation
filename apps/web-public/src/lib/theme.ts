import type { PublicSite } from './api.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const RADIUS: Record<string, string> = { none: '0px', sm: '4px', md: '8px', lg: '16px' };

/** Valores del diseño "Nexus Horizon"; el sitio puede sobrescribirlos con su tema. */
export const DEFAULT_PRIMARY = '#005bbf';
const DEFAULT_PRIMARY_CONTAINER_RGB = '26 115 232'; // #1a73e8
const DEFAULT_RADIUS = RADIUS.md;

type Rgb = readonly [number, number, number];

const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const triplet = (rgb: Rgb): string => rgb.join(' ');
/** La marca aclarada un 15 % hacia el blanco: el tono "hover"/contenedor derivado del color del sitio. */
const lighten = (rgb: Rgb): Rgb => [
  Math.round(rgb[0] * 0.85 + 255 * 0.15),
  Math.round(rgb[1] * 0.85 + 255 * 0.15),
  Math.round(rgb[2] * 0.85 + 255 * 0.15),
];

/**
 * Tokens del sitio → variables CSS que consume `tailwind.config.mjs`. El diseño fija el resto de la
 * paleta y las tipografías; el tema del sitio controla el color de marca (`color_primary`) y el
 * redondeo (`radius`). Cada valor se vuelve a validar aquí porque llega de una API: un tema alterado
 * nunca puede inyectar CSS arbitrario en la página.
 *
 * Los colores viajan también como tripleta RGB (`--brand-*-rgb`): así Tailwind 3 puede aplicar
 * transparencias (`bg-primary/10`) sobre un color que se decide en tiempo de ejecución.
 */
export function themeStyle(theme: PublicSite['theme'] | undefined): string {
  const t = (theme ?? {}) as Record<string, string | undefined>;
  const primary = t.color_primary && HEX.test(t.color_primary) ? t.color_primary : DEFAULT_PRIMARY;
  const radius = RADIUS[t.radius ?? ''] ?? DEFAULT_RADIUS;
  const rgb = hexToRgb(primary);
  // Con la marca del diseño va su tono exacto de contenedor; con otra, un derivado más claro.
  const containerRgb =
    primary.toLowerCase() === DEFAULT_PRIMARY
      ? DEFAULT_PRIMARY_CONTAINER_RGB
      : triplet(lighten(rgb));
  return [
    // Prefijo `--brand-`: evita choques con los nombres de variables de las herramientas de estilos.
    `--brand-primary:${primary}`,
    `--brand-primary-rgb:${triplet(rgb)}`,
    `--brand-primary-container-rgb:${containerRgb}`,
    `--brand-radius:${radius}`,
  ].join(';');
}
