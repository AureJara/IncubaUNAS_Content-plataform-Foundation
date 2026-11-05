/**
 * Códigos estables de error. Deben coincidir con `ErrorCode` de contracts/openapi/common.v1.yaml
 * (hay una prueba de contrato que lo verifica).
 */
export const ERROR_CODES = [
  'invalid_state_transition',
  'stale_revision',
  'tenant_forbidden',
  'validation_failed',
  'idempotency_key_reused',
  'idempotency_key_required',
  'already_exists',
  'last_owner_required',
  'invitation_expired',
  'invitation_not_pending',
  'mfa_required',
  'recent_authentication_required',
  'csrf_invalid',
  'return_to_not_allowed',
  'session_revoked',
  'publication_incomplete',
  'release_gap',
  'resource_in_use',
  'media_not_ready',
  'media_quarantined',
  'domain_verification_failed',
  'rate_limited',
  'unauthenticated',
  'forbidden',
  'not_found',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface FieldError {
  /** JSON Pointer al campo. */
  pointer: string;
  code: string;
  message: string;
}

/** Error esperado de negocio o de protocolo; la capa HTTP lo traduce a Problem Details. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly errors: readonly FieldError[] = [],
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthenticated = (message = 'Se requiere una sesión o un token válido.') =>
  new AppError('unauthenticated', 401, message);

export const forbidden = (message = 'No tienes permiso para realizar esta acción.') =>
  new AppError('forbidden', 403, message);

/** 404 deliberado también para recursos de otra organización, para evitar enumeración. */
export const notFound = (what = 'El recurso') =>
  new AppError('not_found', 404, `${what} no existe o no está disponible.`);

export const conflict = (code: ErrorCode, message: string) => new AppError(code, 409, message);

export const staleRevision = () =>
  new AppError('stale_revision', 412, 'La revisión enviada ya no es la vigente.');

export const invalidTransition = (aggregate: string, from: string, to: string) =>
  new AppError(
    'invalid_state_transition',
    409,
    `${aggregate} no puede pasar de "${from}" a "${to}".`,
  );

export const validationFailed = (message: string, errors: readonly FieldError[] = []) =>
  new AppError('validation_failed', 422, message, errors);

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;
