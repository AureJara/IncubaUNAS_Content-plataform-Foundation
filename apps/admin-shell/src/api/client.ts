import type { components } from './platform-types.generated';

export type Me = components['schemas']['Me'];
export type Capabilities = components['schemas']['Capabilities'];
export type Membership = components['schemas']['Membership'];
export type Role = components['schemas']['Role'];
export type Scope = components['schemas']['Scope'];
export type OrganizationSummary = components['schemas']['OrganizationMembershipSummary'];
export type SessionInfo = components['schemas']['SessionInfo'];
export type AuditEvent = components['schemas']['AuditEvent'];

/** Error de la API con su código estable (Problem Details). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CSRF_COOKIE = '__Host-csrf';

/** La cookie de CSRF es legible a propósito; la de sesión es HttpOnly y el JavaScript nunca la ve. */
function csrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`))
    ?.slice(CSRF_COOKIE.length + 1);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Revisión del recurso que se edita; se envía como `If-Match`. */
  ifMatch?: number;
}

/**
 * Cliente de las APIs bajo el mismo origen. Aplica las convenciones del contrato: CSRF en
 * mutaciones, `Idempotency-Key` en comandos y `If-Match` en ediciones; y traduce Problem Details.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };

  if (options.body !== undefined) {
    headers['content-type'] =
      method === 'PATCH' ? 'application/merge-patch+json' : 'application/json';
  }
  if (method !== 'GET') {
    const token = csrfToken();
    if (token) headers['x-csrf-token'] = token;
  }
  if (method === 'POST') headers['idempotency-key'] = crypto.randomUUID();
  if (options.ifMatch !== undefined) headers['if-match'] = `"${options.ifMatch}"`;

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;
  const isJson = (response.headers.get('content-type') ?? '').includes('json');
  const payload: unknown = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const problem = (payload ?? {}) as {
      code?: string;
      detail?: string;
      title?: string;
      request_id?: string;
    };
    throw new ApiError(
      response.status,
      problem.code ?? 'unknown',
      problem.detail ?? problem.title ?? `Error ${response.status}`,
      problem.request_id,
    );
  }
  return payload as T;
}

/** Mensajes para quien usa el panel; el código estable decide el texto, no el detalle técnico. */
const FRIENDLY: Record<string, string> = {
  last_owner_required: 'La organización debe conservar al menos un owner activo.',
  stale_revision: 'Alguien más modificó este registro. Recarga la lista e inténtalo de nuevo.',
  already_exists: 'Ya existe un registro con esos datos.',
  forbidden: 'No tienes permiso para esta acción.',
  mfa_required: 'Esta acción exige verificación en dos pasos.',
  recent_authentication_required: 'Vuelve a iniciar sesión para continuar.',
  invalid_state_transition: 'Esta acción no se puede hacer en el estado actual.',
};

export const friendlyMessage = (error: unknown): string =>
  error instanceof ApiError
    ? (FRIENDLY[error.code] ?? error.message)
    : 'No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.';

export const loginUrl = (): string =>
  `/auth/login?return_to=${encodeURIComponent(window.location.href)}`;
