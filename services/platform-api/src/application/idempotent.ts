import { runIdempotent, type IdempotentResult } from '@incubaunas/service-kit';
import type { Clock } from '@incubaunas/shared-kernel';
import type { IdempotencyScope, Repositories } from './ports.js';

export type { IdempotentResult };

/** Atajo que toma el almacén de idempotencia del conjunto de repositorios de la transacción. */
export function idempotent<T>(
  repositories: Repositories,
  clock: Clock,
  scope: IdempotencyScope,
  key: string,
  request: unknown,
  work: () => Promise<T>,
): Promise<IdempotentResult<T>> {
  return runIdempotent(repositories.idempotency, clock, scope, key, request, work);
}
