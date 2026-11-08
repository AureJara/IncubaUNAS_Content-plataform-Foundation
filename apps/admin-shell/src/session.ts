// Sesión del shell (FE-06): la ruta raíz la carga con `/platform/v1/me` y cada ruta exige su capability. Es solo
// experiencia de uso: la autorización real la hacen el gateway y cada API (spec 6.2).
import { responseState, type PlatformComponents } from '@incuba/api-client';
import {
  createContext,
  data,
  redirectDocument,
  useRouteLoaderData,
  type LoaderFunctionArgs,
  type MiddlewareFunction,
} from 'react-router';
import { apiContext, routeError } from './api.ts';

export type Me = PlatformComponents['schemas']['Me'];
export type Scope = PlatformComponents['schemas']['Scope'];

export interface Session {
  me: Me;
  /** Estado de la operación que respondió (MOCK-04): el shell avisa cuando los datos son de prueba. */
  mock: ReturnType<typeof responseState>;
}

export const sessionContext = createContext<Session>();

/** Login del gateway; `return_to` vuelve a la misma página y el gateway lo valida contra su allowlist (RN-12). */
export function loginUrl(request: Request): string {
  const { pathname, search } = new URL(request.url);
  return `/auth/login?return_to=${encodeURIComponent(pathname + search)}`;
}

export const loadSession: MiddlewareFunction = async ({ request, context }) => {
  const { platform } = context.get(apiContext);
  const { data: me, error, response } = await platform.GET('/platform/v1/me', { signal: request.signal });
  if (response.status === 401) throw redirectDocument(loginUrl(request));
  if (!me) routeError(response, error);
  context.set(sessionContext, { me, mock: responseState(response) });
};

export function sessionLoader({ context }: LoaderFunctionArgs): Session {
  return context.get(sessionContext);
}

/** La URL lleva la organización activa (`/o/{slug}`); otra organización no existe para esta sesión. */
export const requireActiveOrganization: MiddlewareFunction = ({ params, context }) => {
  const { me } = context.get(sessionContext);
  if (!me.active_organization || me.active_organization.slug !== params['orgSlug']) throw data(null, { status: 404 });
};

/** Sin la capability, la ruta muestra "sin acceso" y no llama a su API (FE-06). */
export function requireCapability(capability: Scope): MiddlewareFunction {
  return ({ context }) => {
    if (!context.get(sessionContext).me.capabilities.includes(capability)) throw data({ capability }, { status: 403 });
  };
}

export function useSession(): Session {
  const session = useRouteLoaderData<typeof sessionLoader>('root');
  if (!session) throw new Error('La sesión se carga en la ruta raíz.');
  return session;
}
