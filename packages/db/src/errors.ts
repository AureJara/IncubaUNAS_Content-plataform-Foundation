/** Códigos SQLSTATE que la aplicación sabe traducir a errores de negocio. */
export const PG = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
  raiseException: 'P0001',
  serializationFailure: '40001',
  deadlockDetected: '40P01',
} as const;

interface PgErrorLike {
  code?: string;
  constraint?: string;
  message?: string;
}

const asPgError = (error: unknown): PgErrorLike =>
  typeof error === 'object' && error !== null ? (error as PgErrorLike) : {};

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = asPgError(error);
  return e.code === PG.uniqueViolation && (constraint === undefined || e.constraint === constraint);
}

export function isRaisedException(error: unknown, messagePart: string): boolean {
  const e = asPgError(error);
  return e.code === PG.raiseException && (e.message ?? '').includes(messagePart);
}

export const isRetryable = (error: unknown): boolean =>
  [PG.serializationFailure, PG.deadlockDetected].includes(asPgError(error).code as never);
