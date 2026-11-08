// Entrada del shell: lleva a la organización activa; sin organización, lo explica.
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { sessionContext } from '../session.ts';

export function startLoader({ context }: LoaderFunctionArgs) {
  const organization = context.get(sessionContext).me.active_organization;
  if (organization) throw redirect(`/o/${encodeURIComponent(organization.slug)}`);
  return null;
}

export function NoOrganization() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <div className="w-full space-y-2 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="font-headline-md text-headline-md text-on-surface">Sin organización activa</h1>
        <p className="font-body-md text-body-md text-secondary">
          Tu cuenta todavía no pertenece a ninguna organización. Pide una invitación a quien administra la tuya.
        </p>
      </div>
    </main>
  );
}

export function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center" aria-busy="true">
      <p className="font-body-md text-body-md text-secondary">Cargando tu sesión…</p>
    </main>
  );
}
