import type { DomainError } from '@incuba/shared-kernel';

/** Error de un campo, con JSON Pointer (spec 9.1). */
export interface ProblemFieldError {
  pointer: string;
  detail: string;
  code?: string;
}

/** Problem Details (RFC 9457) con `code` y `request_id` (spec 9.1). */
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  request_id: string;
  errors?: ProblemFieldError[];
}

const TITLES: Readonly<Record<string, string>> = {
  bad_request: 'Bad request',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  recent_auth_required: 'Recent authentication required',
  tenant_forbidden: 'Tenant forbidden',
  not_found: 'Not found',
  unsupported_media_type: 'Unsupported media type',
  payload_too_large: 'Payload too large',
  validation_failed: 'Validation failed',
  invalid_state_transition: 'Invalid state transition',
  idempotency_key_reused: 'Idempotency key reused',
  request_in_progress: 'Request in progress',
  stale_revision: 'Stale revision',
  precondition_required: 'Precondition required',
  rate_limited: 'Too many requests',
  internal_error: 'Internal error',
  service_unavailable: 'Service unavailable',
};

/** Estado HTTP de cada código de dominio del catálogo (spec 9.7). */
const DOMAIN_STATUS: Readonly<Record<string, number>> = {
  invalid_state_transition: 409,
  stale_revision: 412,
  tenant_forbidden: 403,
  idempotency_key_reused: 409,
  invitation_expired: 409,
  publication_incomplete: 409,
  release_gap: 409,
  file_not_ready: 409,
  file_quarantined: 409,
  last_owner: 409,
  slug_taken: 409,
  hostname_taken: 409,
  not_found: 404,
  preview_expired: 404,
};

export function problemType(code: string): string {
  return `https://errors.example.pe/${code.replaceAll('_', '-')}`;
}

function titleFor(code: string): string {
  return TITLES[code] ?? code.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

export interface HttpProblemInit {
  status: number;
  code: string;
  title?: string;
  detail?: string;
  errors?: ProblemFieldError[];
  headers?: Record<string, string>;
}

/** Error que un handler lanza para responder con Problem Details. */
export class HttpProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: ProblemFieldError[] | undefined;
  readonly headers: Readonly<Record<string, string>>;

  constructor(init: HttpProblemInit) {
    super(init.detail ?? init.code);
    this.name = 'HttpProblem';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title ?? titleFor(init.code);
    this.detail = init.detail;
    this.errors = init.errors;
    this.headers = init.headers ?? {};
  }

  toProblem(requestId: string): Problem {
    const problem: Problem = {
      type: problemType(this.code),
      title: this.title,
      status: this.status,
      code: this.code,
      request_id: requestId,
    };
    if (this.detail !== undefined) problem.detail = this.detail;
    if (this.errors !== undefined) problem.errors = this.errors;
    return problem;
  }
}

/** Traduce un error de dominio a Problem Details; un código desconocido es un error interno. */
export function problemFromDomainError(error: DomainError): HttpProblem {
  const status = DOMAIN_STATUS[error.code];
  if (status === undefined) {
    return new HttpProblem({ status: 500, code: 'internal_error', detail: 'Error interno.' });
  }
  return new HttpProblem({ status, code: error.code, detail: error.message });
}
