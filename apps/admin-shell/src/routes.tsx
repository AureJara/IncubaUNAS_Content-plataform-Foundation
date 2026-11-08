// Rutas del panel de gestión (data mode de React Router, FE-01). React Router es la única capa de datos: cada loader
// llama al cliente generado desde el contexto, y los middlewares cargan la sesión y exigen permisos (FE-02, FE-06).
import { data, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { Dashboard } from './routes/dashboard.tsx';
import { PendingModule, pendingModuleLoader } from './routes/pending-module.tsx';
import { RootError, RouteError } from './routes/route-error.tsx';
import { Sites, sitesLoader } from './routes/sites.tsx';
import { Loading, NoOrganization, startLoader } from './routes/start.tsx';
import { loadSession, requireActiveOrganization, requireCapability, sessionContext, sessionLoader } from './session.ts';
import { Shell } from './shell/shell.tsx';

/** El loader de la organización hace que sus middlewares corran también al cambiar de `/o/{slug}`. */
function organizationLoader({ context }: LoaderFunctionArgs) {
  return context.get(sessionContext).me.active_organization;
}

function notFound(): never {
  throw data(null, { status: 404 });
}

export const routes = [
  {
    id: 'root',
    path: '/',
    middleware: [loadSession],
    loader: sessionLoader,
    HydrateFallback: Loading,
    ErrorBoundary: RootError,
    children: [
      { index: true, loader: startLoader, Component: NoOrganization },
      {
        path: 'o/:orgSlug',
        middleware: [requireActiveOrganization],
        loader: organizationLoader,
        Component: Shell,
        ErrorBoundary: RootError,
        children: [
          { index: true, Component: Dashboard },
          {
            path: 'sitios',
            middleware: [requireCapability('sites:write')],
            loader: sitesLoader,
            Component: Sites,
            ErrorBoundary: RouteError,
          },
          {
            path: 'modulos/:moduleId',
            loader: pendingModuleLoader,
            Component: PendingModule,
            ErrorBoundary: RouteError,
          },
          { path: '*', loader: notFound, ErrorBoundary: RouteError },
        ],
      },
    ],
  },
] satisfies RouteObject[];
