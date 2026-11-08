// Cabecera, pie y banner del sitio público con los tokens Nexus Horizon. El tema propio de cada sitio (PF-042) queda
// pendiente: aplicarlo con estilos en línea rompería la CSP (`style-src 'self'`).
import type { PublicComponents } from '@incuba/api-client';
import { Icon } from '@incuba/ui';
import { Link } from 'react-router';
import { isSameSite, safeHref } from '../links.ts';

type PublicSite = PublicComponents['schemas']['PublicSite'];
type NavigationItem = PublicSite['navigation'][number];

function NavLinkItem({ item }: { item: NavigationItem }) {
  const href = safeHref(item.href);
  const className =
    'block rounded-lg px-3 py-2 font-label-lg text-label-lg text-secondary transition-colors hover:bg-surface-container hover:text-on-surface';
  if (!href) return null;
  if (isSameSite(href)) {
    return (
      <Link to={href} className={className}>
        {item.label}
      </Link>
    );
  }
  return (
    <a href={href} className={className} rel="noopener noreferrer">
      {item.label}
    </a>
  );
}

function NavItems({ items }: { items: readonly NavigationItem[] }) {
  return (
    <ul className="flex flex-col gap-1 md:flex-row md:items-center">
      {items.map((item) => (
        <li key={`${item.href}-${item.label}`}>
          <NavLinkItem item={item} />
        </li>
      ))}
    </ul>
  );
}

export function SiteHeader({ site }: { site: PublicSite }) {
  return (
    <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-surface-container-lowest shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:px-12">
        <Link to="/" className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
          {site.name}
        </Link>
        {site.navigation.length > 0 && (
          <>
            <nav aria-label="Principal" className="hidden md:block">
              <NavItems items={site.navigation} />
            </nav>
            <details className="relative md:hidden">
              <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-label-lg text-label-lg text-on-surface">
                <Icon name="menu" className="text-xl" />
                Menú
              </summary>
              <nav
                aria-label="Principal"
                className="absolute right-0 mt-2 w-60 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-2 shadow-sm"
              >
                <NavItems items={site.navigation} />
              </nav>
            </details>
          </>
        )}
      </div>
    </header>
  );
}

export function DemoBanner() {
  return (
    <p className="bg-tertiary-fixed px-6 py-2 text-center font-label-md text-label-md text-on-tertiary-fixed">
      Sitio de demostración: el contenido es de ejemplo.
    </p>
  );
}

export function SiteFooter({ name }: { name: string }) {
  return (
    <footer className="mt-16 border-t border-surface-container-highest bg-surface-container-lowest">
      <div className="mx-auto max-w-7xl space-y-2 px-6 py-12 lg:px-12">
        <p className="font-title text-title text-on-surface">{name}</p>
        <p className="font-body-sm text-body-sm text-secondary">
          Incubadora de Empresas de la Universidad Nacional Agraria de la Selva · Tingo María, Huánuco
        </p>
      </div>
    </footer>
  );
}
