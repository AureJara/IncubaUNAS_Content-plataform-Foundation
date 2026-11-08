// Marco del panel de gestión según el diseño Nexus Horizon: cabecera, menú lateral, contenido y pie. Reconstruido en
// React desde el HTML de Stitch sin CDNs, scripts en línea ni `innerHTML` (SEC-13).
import { Icon } from '@incuba/ui';
import { NavLink, Outlet } from 'react-router';
import { initials, roleLabel, visibleNavItems, type NavItem } from '../navigation.ts';
import { useSession, type Session } from '../session.ts';

export function Shell() {
  const session = useSession();
  const items = visibleNavItems(session.me.capabilities);
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Saltar al contenido
      </a>
      <ShellHeader session={session} />
      <MobileNav items={items} />
      <div className="mx-auto flex w-full max-w-7xl flex-grow items-start gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <Sidebar session={session} items={items} />
        <main id="contenido" className="min-w-0 flex-1 space-y-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ShellFooter />
    </div>
  );
}

function Logo() {
  return (
    <span className="font-headline-sm text-headline-sm tracking-tight">
      <span className="text-primary">Incuba</span>
      <span className="text-on-surface">UNAS</span>
    </span>
  );
}

function ShellHeader({ session }: { session: Session }) {
  const { me } = session;
  return (
    <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-surface-container-lowest shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:px-12">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden font-label-md text-label-md text-secondary sm:inline">Panel de gestión</span>
          {session.mock !== 'real' && (
            <span
              className="rounded-full bg-tertiary-fixed px-2.5 py-0.5 font-label-sm text-label-sm text-on-tertiary-fixed"
              title="Las APIs responden con su mock (spec 3.8)"
            >
              Datos de prueba
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="font-label-lg text-label-lg text-on-surface">{me.display_name}</p>
            <p className="font-label-sm text-label-sm text-secondary">{roleLabel(me.roles)}</p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-title text-sm font-bold text-on-primary ring-2 ring-primary/20"
          >
            {initials(me.display_name)}
          </span>
        </div>
      </div>
    </header>
  );
}

function NavList({ items }: { items: readonly NavItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 font-label-lg text-label-lg transition-colors ${
                isActive
                  ? 'bg-primary font-bold text-on-primary shadow-sm'
                  : 'text-secondary hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <Icon name={item.icon} className="shrink-0 text-xl" />
            <span>{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function MobileNav({ items }: { items: readonly NavItem[] }) {
  return (
    <details className="border-b border-surface-container-highest bg-surface-container-lowest lg:hidden">
      <summary className="mx-auto flex max-w-7xl cursor-pointer items-center gap-2 px-6 py-3 font-label-lg text-label-lg text-on-surface">
        <Icon name="menu" className="text-xl" />
        Menú
      </summary>
      <nav aria-label="Menú principal" className="px-4 pb-4">
        <NavList items={items} />
      </nav>
    </details>
  );
}

function Sidebar({ session, items }: { session: Session; items: readonly NavItem[] }) {
  const organization = session.me.active_organization;
  return (
    <aside className="sticky top-20 hidden w-64 shrink-0 flex-col space-y-6 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-4 shadow-sm lg:flex">
      <nav aria-label="Menú principal">
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary">Gestión</p>
        <NavList items={items} />
      </nav>
      {organization && (
        <div className="rounded-lg border border-surface-container-highest bg-surface-container-low/70 p-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary"
            >
              {initials(organization.display_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-label-lg text-label-lg text-on-surface">{organization.display_name}</p>
              <p className="font-label-sm text-label-sm text-secondary">Organización activa</p>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        disabled
        aria-describedby="cerrar-sesion-nota"
        className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 font-label-lg text-label-lg text-secondary opacity-70"
      >
        <Icon name="logout" className="text-xl" />
        Cerrar sesión
      </button>
      <p id="cerrar-sesion-nota" className="sr-only">
        Disponible cuando el gateway emita la sesión real (Fase 1).
      </p>
    </aside>
  );
}

function ShellFooter() {
  return (
    <footer className="mt-16 border-t border-surface-container-highest bg-surface-container-lowest">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-12 lg:px-12">
        <div className="max-w-md space-y-2">
          <Logo />
          <p className="font-body-sm text-body-sm text-secondary">
            Incubadora de Empresas de la Universidad Nacional Agraria de la Selva. Impulsando la bioeconomía, AgTech y
            el emprendimiento en la Amazonía Peruana.
          </p>
          <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary">
            <Icon name="location_on" className="text-base" />
            Tingo María, Huánuco
          </p>
        </div>
        <p className="border-t border-surface-container-highest pt-6 font-label-md text-label-md text-secondary">
          © 2026 IncubaUNAS · Dirección de Emprendimiento
        </p>
      </div>
    </footer>
  );
}
