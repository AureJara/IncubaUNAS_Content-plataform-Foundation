import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { api, type OrganizationSummary } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import type { ShellModule } from './modules';
import { useAsync } from './useAsync';

/**
 * Marco del panel: navegación por permisos, selector de organización, cierre de sesión y
 * gestión del foco al cambiar de ruta (accesibilidad: el lector de pantalla anuncia la nueva página).
 */
export function Shell({ modules }: { modules: readonly ShellModule[] }) {
  const { state, logout, can, switchOrganization } = useAuth();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const organizations = useAsync(() =>
    api<{ items: OrganizationSummary[] }>('/platform/v1/me/organizations'),
  );

  useEffect(() => {
    main.current?.focus();
  }, [location.pathname]);

  if (state.status !== 'authenticated') return null;
  const visible = modules.filter((m) => can(m.requiredScope));
  const active = state.capabilities?.organization_id;
  const choices = organizations.status === 'ready' ? organizations.data.items : [];

  return (
    <div className="shell">
      <a className="skip-link" href="#principal">
        Saltar al contenido
      </a>
      <header role="banner" className="shell-header">
        <strong>IncubaUNAS</strong>
        {choices.length > 1 && (
          <label>
            <span className="visually-hidden">Organización activa</span>
            <select value={active ?? ''} onChange={(e) => void switchOrganization(e.target.value)}>
              {!active && <option value="">Elige una organización</option>}
              {choices.map((o) => (
                <option key={o.organization_id} value={o.organization_id}>
                  {o.display_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="spacer" />
        <span>{state.me.display_name ?? state.me.email}</span>
        <button type="button" onClick={() => void logout()}>
          Cerrar sesión
        </button>
      </header>

      <div className="shell-body">
        <nav aria-label="Principal" className="shell-nav">
          <ul className="plain">
            <li>
              <NavLink to="/" end>
                Inicio
              </NavLink>
            </li>
            {visible.map((m) => (
              <li key={m.id}>
                <NavLink to={`/${m.path}`}>{m.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="principal" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
