// Cliente HTTP tipado de las APIs del Equipo 1 (API-04). Los tipos salen de los contratos con `pnpm contracts:build`;
// el shell, web-public y los equipos 2–4 usan este cliente, así que no cambia cuando una operación pasa de mock a real
// (spec 3.8). Sin dependencias de Node: corre en el navegador.
import createClient, { type Client, type ClientOptions, type Middleware } from 'openapi-fetch';
import type { paths as AuthPaths } from './generated/auth.ts';
import type { paths as CmsPaths } from './generated/cms.ts';
import type { paths as PlatformPaths } from './generated/platform.ts';
import type { paths as PublicPaths } from './generated/public.ts';

export type { components as AuthComponents, paths as AuthPaths } from './generated/auth.ts';
export type { components as CmsComponents, paths as CmsPaths } from './generated/cms.ts';
export type { components as PlatformComponents, paths as PlatformPaths } from './generated/platform.ts';
export type { components as PublicComponents, paths as PublicPaths } from './generated/public.ts';

type Credentials = 'include' | 'omit' | 'same-origin';

export interface ApiClientOptions {
  /** Origen del gateway (shell) o de la Public Read API (web-public). */
  baseUrl: string;
  fetch?: (input: Request) => Promise<Response>;
  /** Solo en local: pide un ejemplo concreto del mock con `Prefer: example=<nombre>` (MOCK-01). */
  preferExample?: string;
  /** `include` para el BFF con cookie de sesión (por defecto); `omit` para la API pública. */
  credentials?: Credentials;
}

/** Los PATCH del contrato son JSON Merge Patch (spec 9.1). */
const mergePatch: Middleware = {
  onRequest({ request }) {
    if (request.method === 'PATCH' && request.headers.get('content-type')?.startsWith('application/json')) {
      request.headers.set('content-type', 'application/merge-patch+json');
    }
    return request;
  },
};

function make<Paths extends object>(options: ApiClientOptions, credentials: Credentials): Client<Paths> {
  const clientOptions: ClientOptions = { baseUrl: options.baseUrl, credentials: options.credentials ?? credentials };
  if (options.fetch) clientOptions.fetch = options.fetch;
  if (options.preferExample) clientOptions.headers = { Prefer: `example=${options.preferExample}` };
  const client = createClient<Paths>(clientOptions);
  client.use(mergePatch);
  return client;
}

export const createAuthClient = (options: ApiClientOptions) => make<AuthPaths>(options, 'include');
export const createPlatformClient = (options: ApiClientOptions) => make<PlatformPaths>(options, 'include');
export const createCmsClient = (options: ApiClientOptions) => make<CmsPaths>(options, 'include');
export const createPublicClient = (options: ApiClientOptions) => make<PublicPaths>(options, 'omit');

/** Clave nueva para un POST de comando: se reutiliza al reintentar el mismo comando (RN-22). */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

/** ETag de una revisión, para `If-Match`. */
export function ifMatch(revision: number): string {
  return `"r${revision}"`;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  request_id: string;
  errors?: { pointer: string; detail: string; code?: string }[];
}

export function isProblem(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['code'] === 'string' && typeof v['status'] === 'number' && typeof v['request_id'] === 'string';
}

/** Estado de la operación que respondió (MOCK-04): `example`, `memory` o `real`. */
export function responseState(response: Response): 'example' | 'memory' | 'real' {
  const mock = response.headers.get('x-mock');
  return mock === 'example' || mock === 'memory' ? mock : 'real';
}
