// Errores de ruta. Se muestran el código y el `request_id` del Problem Details para soporte, nunca trazas ni detalles
// internos (SEC-11).
import { isProblem } from '@incuba/api-client';
import { Icon } from '@incuba/ui';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Card } from '../shell/page.tsx';

interface ErrorView {
  title: string;
  message: string;
  requestId?: string;
}

function describe(error: unknown): ErrorView {
  if (!isRouteErrorResponse(error)) {
    return {
      title: 'Algo salió mal',
      message: 'No pudimos mostrar esta pantalla. Vuelve a intentarlo en unos minutos.',
    };
  }
  if (error.status === 403) {
    return { title: 'Sin acceso', message: 'Tu rol no tiene permiso para ver esta sección.' };
  }
  if (error.status === 404) {
    return { title: 'No encontrado', message: 'La página que buscas no existe o ya no está disponible.' };
  }
  const problem: unknown = error.data;
  const view: ErrorView = { title: 'Algo salió mal', message: 'El servicio no respondió como se esperaba.' };
  if (isProblem(problem)) view.requestId = problem.request_id;
  return view;
}

function ErrorContent({ view }: { view: ErrorView }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row" role="alert">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container">
        <Icon name={view.title === 'Sin acceso' ? 'lock' : 'error'} className="text-2xl" />
      </span>
      <div className="space-y-2">
        <h1 className="font-headline-md text-headline-md text-on-surface">{view.title}</h1>
        <p className="font-body-md text-body-md text-secondary">{view.message}</p>
        {view.requestId && (
          <p className="font-body-sm text-body-sm text-secondary">
            Código para soporte: <code className="text-on-surface">{view.requestId}</code>
          </p>
        )}
        <Link to="/" className="inline-block font-label-lg text-label-lg text-primary hover:underline">
          Ir al panel principal
        </Link>
      </div>
    </div>
  );
}

/** Error dentro del marco del shell: el menú sigue disponible. */
export function RouteError() {
  return (
    <Card>
      <ErrorContent view={describe(useRouteError())} />
    </Card>
  );
}

/** Error antes de tener sesión u organización: página completa sin el marco. */
export function RootError() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-12">
      <div className="w-full rounded-xl border border-surface-container-highest bg-surface-container-lowest p-8 shadow-sm">
        <ErrorContent view={describe(useRouteError())} />
      </div>
    </main>
  );
}
