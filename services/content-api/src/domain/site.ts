import { validationFailed, type Uuid } from '@incubaunas/shared-kernel';

export type SiteKind = 'product' | 'demo' | 'client';

export interface ThemeTokens {
  color_primary?: string;
  color_background?: string;
  color_text?: string;
  font_family?: 'system-ui' | 'inter' | 'source-serif';
  radius?: 'none' | 'sm' | 'md' | 'lg';
}

export interface NavigationItem {
  label: string;
  href: string;
}

export interface SiteSnapshot {
  id: Uuid;
  organizationId: Uuid;
  slug: string;
  name: string;
  kind: SiteKind;
  locale: string;
  theme: ThemeTokens;
  navigation: NavigationItem[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

const SLUG = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED = new Set(['www', 'api', 'admin', 'auth', 'cms', 'public', 'static', 'preview']);
const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/;
const SAFE_HREF = /^(\/(?!\/)|https:\/\/)/;

/** Luminancia relativa y relación de contraste de WCAG 2.x. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** El tema solo es válido si el texto y los botones se leen bien sobre el fondo (WCAG AA). */
export function assertTheme(theme: ThemeTokens): ThemeTokens {
  const background = theme.color_background ?? '#ffffff';
  const checks: [string | undefined, number, string][] = [
    [theme.color_text, 4.5, '/theme/color_text'],
    [theme.color_primary, 3, '/theme/color_primary'],
  ];
  const errors = checks.flatMap(([color, minimum, pointer]) =>
    color && contrastRatio(color, background) < minimum
      ? [
          {
            pointer,
            code: 'contrast',
            message: `El contraste con el fondo debe ser de al menos ${minimum}:1.`,
          },
        ]
      : [],
  );
  if (errors.length > 0) throw validationFailed('El tema no cumple el contraste mínimo.', errors);
  return theme;
}

export function assertNavigation(items: readonly NavigationItem[]): NavigationItem[] {
  const errors = items.flatMap((item, index) =>
    SAFE_HREF.test(item.href)
      ? []
      : [
          {
            pointer: `/navigation/${index}/href`,
            code: 'unsafe_link',
            message: 'Usa una ruta relativa o un enlace HTTPS.',
          },
        ],
  );
  if (errors.length > 0)
    throw validationFailed('La navegación tiene enlaces no permitidos.', errors);
  return [...items];
}

export function assertSiteSlug(slug: string): string {
  if (!SLUG.test(slug) || RESERVED.has(slug)) {
    throw validationFailed('El slug del sitio no es válido o está reservado.', [
      { pointer: '/slug', code: 'pattern', message: 'Usa minúsculas, números y guiones.' },
    ]);
  }
  return slug;
}

export function assertLocale(locale: string): string {
  if (!LOCALE.test(locale)) {
    throw validationFailed('El idioma no es válido.', [
      { pointer: '/locale', code: 'pattern', message: 'Usa un código como es-PE.' },
    ]);
  }
  return locale;
}

export function newSite(
  input: {
    id: Uuid;
    organizationId: Uuid;
    slug: string;
    name: string;
    kind: SiteKind;
    locale: string;
  },
  now: Date,
): SiteSnapshot {
  return {
    id: input.id,
    organizationId: input.organizationId,
    slug: assertSiteSlug(input.slug),
    name: input.name.trim(),
    kind: input.kind,
    locale: assertLocale(input.locale),
    theme: {},
    navigation: [],
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function applySitePatch(
  site: SiteSnapshot,
  patch: { name?: string; locale?: string; theme?: ThemeTokens; navigation?: NavigationItem[] },
  now: Date,
): SiteSnapshot {
  return {
    ...site,
    name: patch.name?.trim() ?? site.name,
    locale: patch.locale ? assertLocale(patch.locale) : site.locale,
    theme: patch.theme ? assertTheme({ ...patch.theme }) : site.theme,
    navigation: patch.navigation ? assertNavigation(patch.navigation) : site.navigation,
    updatedAt: now,
  };
}
