import type { PublicSite } from './api.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const RADIUS: Record<string, string> = { none: '0px', sm: '4px', md: '8px', lg: '16px' };

/** Valores del diseño "Nexus Horizon"; el sitio puede sobrescribirlos con su tema. */
export const DEFAULT_PRIMARY = '#005bbf';
const DEFAULT_PRIMARY_CONTAINER = '#1a73e8';
const DEFAULT_RADIUS = RADIUS.md;

/**
 * Tokens del sitio → variables CSS que consume `tailwind.config.mjs`. El diseño fija el resto de la
 * paleta y las tipografías; el tema del sitio controla el color de marca (`color_primary`) y el
 * redondeo (`radius`). Cada valor se vuelve a validar aquí porque llega de una API: un tema alterado
 * nunca puede inyectar CSS arbitrario en la página.
 */
export function themeStyle(theme: PublicSite['theme'] | undefined): string {
  const t = (theme ?? {}) as Record<string, string | undefined>;
  const primary = t.color_primary && HEX.test(t.color_primary) ? t.color_primary : DEFAULT_PRIMARY;
  const radius = RADIUS[t.radius ?? ''] ?? DEFAULT_RADIUS;
  // Estado "hover"/contenedor: con la marca del diseño va su tono exacto; con otra, un derivado más claro.
  const container =
    primary.toLowerCase() === DEFAULT_PRIMARY
      ? DEFAULT_PRIMARY_CONTAINER
      : `color-mix(in srgb, ${primary} 85%, white)`;
  return [
    // Prefijo `--brand-`: `--color-*` y `--radius-*` son nombres que Tailwind genera por su cuenta.
    `--brand-primary:${primary}`,
    `--brand-primary-container:${container}`,
    `--brand-radius:${radius}`,
  ].join(';');
}
