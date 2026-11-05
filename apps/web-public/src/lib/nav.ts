import { safeHref } from './format.js';
import type { PublicSite } from './api.js';

export interface NavItem {
  label: string;
  href: string;
}

/** Menú del diseño; se usa mientras el sitio no tenga uno propio en el CMS (o la API no responda). */
export const DEFAULT_NAVIGATION: readonly NavItem[] = [
  { label: 'Nosotros', href: '/nosotros' },
  { label: 'Eventos', href: '/eventos' },
  { label: 'Programas', href: '/programas' },
  { label: 'Convocar', href: '/convocar' },
  { label: 'Portafolio', href: '/portafolio' },
];

/** El menú lo gobierna el CMS; cada `href` se revalida porque llega de una API. */
export function resolveNavigation(
  site: Pick<PublicSite, 'navigation'> | null | undefined,
): NavItem[] {
  const items = site?.navigation ?? [];
  if (items.length === 0) return [...DEFAULT_NAVIGATION];
  return items.map((item) => ({ label: item.label, href: safeHref(item.href) }));
}

/** Un enlace está activo en su propia ruta y en las que cuelgan de ella (`/eventos/x` activa `/eventos`). */
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/' || href === '#') return href === '/' && pathname === '/';
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return clean === href || clean.startsWith(`${href}/`);
}
