import type { AppError, ErrorCode, FieldError } from './errors.js';

/** Problem Details (RFC 9457) con `code` estable y `request_id`. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  /** `internal_error` solo aparece en 5xx y no forma parte del contrato público de códigos. */
  code: ErrorCode | 'internal_error';
  detail?: string;
  request_id: string;
  errors?: FieldError[];
}

const TITLES: Partial<Record<number, string>> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  412: 'Precondition failed',
  422: 'Unprocessable entity',
  429: 'Too many requests',
};

export function toProblem(error: AppError, requestId: string): Problem {
  return {
    type: `https://errors.incubaunas.dev/${error.code}`,
    title: TITLES[error.status] ?? 'Error',
    status: error.status,
    code: error.code,
    detail: error.message,
    request_id: requestId,
    ...(error.errors.length > 0 ? { errors: [...error.errors] } : {}),
  };
}

/** Problema genérico para fallos inesperados: nunca filtra detalles internos. */
export function internalProblem(requestId: string): Problem {
  return {
    type: 'https://errors.incubaunas.dev/internal_error',
    title: 'Internal server error',
    status: 500,
    code: 'internal_error',
    request_id: requestId,
  };
}
