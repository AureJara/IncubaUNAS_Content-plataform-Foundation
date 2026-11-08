import type { TokenSubject } from '@incuba/authz';

/** Lo que el gateway necesita de un request para encontrar su sesión (cookie y headers). */
export interface IncomingRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

/** Puerto: la sesión del navegador que hace el request, o `undefined` si no hay. */
export type SessionResolver = (request: IncomingRequest) => Promise<TokenSubject | undefined>;
