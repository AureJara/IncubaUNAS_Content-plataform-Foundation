import { HttpProblem } from './problem.ts';

/** ETag fuerte de una revisión: `"r3"`. */
export function etagForRevision(revision: number): string {
  return `"r${revision}"`;
}

/** Revisión que trae `If-Match`, o `null` si no es un ETag nuestro (los débiles nunca coinciden: RFC 9110). */
export function revisionFromIfMatch(header: string | undefined): number | null {
  const match = header?.trim().match(/^"r([1-9][0-9]*)"$/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/**
 * Exige que `If-Match` coincida con la revisión actual (spec 9.1): si falta → 428 `precondition_required`; si no
 * coincide → 412 `stale_revision`.
 */
export function assertIfMatch(header: string | undefined, currentRevision: number): void {
  if (header === undefined || header.trim() === '') {
    throw new HttpProblem({
      status: 428,
      code: 'precondition_required',
      detail: 'Envía el ETag de la revisión en `If-Match`.',
    });
  }
  if (revisionFromIfMatch(header) !== currentRevision) {
    throw new HttpProblem({
      status: 412,
      code: 'stale_revision',
      detail: 'El recurso cambió desde que lo abriste. Recarga y vuelve a aplicar tus cambios.',
      errors: [],
    });
  }
}
