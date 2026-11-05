import { useState } from 'react';
import { api, friendlyMessage, loginUrl, type OrganizationSummary } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, Resource } from '../shell/States';
import { useAsync } from '../shell/useAsync';

export function LoginPage() {
  return (
    <main className="centered">
      <h1>IncubaUNAS</h1>
      <p>Inicia sesión para administrar tus eventos y sitios.</p>
      <a className="button" href={loginUrl()}>
        Iniciar sesión
      </a>
    </main>
  );
}

export const NotFoundPage = () => (
  <section>
    <h1>Página no encontrada</h1>
    <p>La sección que buscas no existe.</p>
  </section>
);

export const ForbiddenPage = () => (
  <section>
    <h1>Sin acceso</h1>
    <p role="alert">
      No tienes permiso para ver esta sección. Pide a un administrador que te asigne el rol
      necesario.
    </p>
  </section>
);

/** Inicio del panel. Si la persona aún no eligió organización, aquí la elige. */
export function DashboardPage() {
  const { state, switchOrganization } = useAuth();
  const organizations = useAsync(() =>
    api<{ items: OrganizationSummary[] }>('/platform/v1/me/organizations'),
  );
  const [error, setError] = useState<string | null>(null);
  if (state.status !== 'authenticated') return null;

  async function choose(id: string) {
    try {
      await switchOrganization(id);
    } catch (e) {
      setError(friendlyMessage(e));
    }
  }

  return (
    <section aria-labelledby="inicio-titulo">
      <h1 id="inicio-titulo">Hola, {state.me.display_name ?? 'bienvenido'}</h1>
      {state.capabilities ? (
        <p>Estás trabajando en tu organización activa con {state.me.roles.length} rol(es).</p>
      ) : (
        <>
          <p>Elige la organización con la que quieres trabajar.</p>
          <div aria-live="polite" role="status">
            {error && <p className="notice notice-error">{error}</p>}
          </div>
          <Resource state={organizations}>
            {({ items }) =>
              items.length === 0 ? (
                <EmptyState>
                  Todavía no perteneces a ninguna organización. Acepta una invitación para empezar.
                </EmptyState>
              ) : (
                <ul className="plain">
                  {items.map((o) => (
                    <li key={o.organization_id} className="card">
                      <button type="button" onClick={() => void choose(o.organization_id)}>
                        {o.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            }
          </Resource>
        </>
      )}
    </section>
  );
}
