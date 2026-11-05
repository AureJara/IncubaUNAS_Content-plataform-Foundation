import { AppError, contentHash, type Clock, type Uuid } from '@incubaunas/shared-kernel';
import type { Actor } from '@incubaunas/tenancy';

// ---------------------------------------------------------------- idempotencia
export interface IdempotencyScope {
  organizationId: Uuid;
  actorId: string;
  operation: string;
}

export interface StoredResponse {
  requestHash: string;
  response: unknown;
}

export interface IdempotencyStore {
  /** Toma un lock de la clave para que dos peticiones simultáneas no ejecuten el comando dos veces. */
  find(scope: IdempotencyScope, key: string): Promise<StoredResponse | null>;
  save(
    scope: IdempotencyScope,
    key: string,
    stored: StoredResponse,
    now: Date,
    expiresAt: Date,
  ): Promise<void>;
}

const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface IdempotentResult<T> {
  value: T;
  replayed: boolean;
}

/**
 * Ejecuta un comando exactamente una vez por `Idempotency-Key`. La misma clave con el mismo cuerpo
 * reproduce la respuesta guardada; con otro cuerpo devuelve 409. Todo ocurre en la misma transacción
 * que el comando, así que la respuesta guardada y el efecto nunca se separan.
 */
export async function runIdempotent<T>(
  store: IdempotencyStore,
  clock: Clock,
  scope: IdempotencyScope,
  key: string,
  request: unknown,
  work: () => Promise<T>,
): Promise<IdempotentResult<T>> {
  const requestHash = contentHash(request);
  const stored = await store.find(scope, key);
  if (stored) {
    if (stored.requestHash !== requestHash) {
      throw new AppError(
        'idempotency_key_reused',
        409,
        'La Idempotency-Key ya se usó con otra petición.',
      );
    }
    return { value: stored.response as T, replayed: true };
  }

  const value = await work();
  const now = clock.now();
  await store.save(
    scope,
    key,
    { requestHash, response: value },
    now,
    new Date(now.getTime() + DEFAULT_RETENTION_MS),
  );
  return { value, replayed: false };
}

// ---------------------------------------------------------------- auditoría
export interface AuditEntry {
  organizationId: Uuid | null;
  actor: Actor;
  action: string;
  target: { type: string; id: string };
  outcome: 'success' | 'denied' | 'failure';
  requestId: string;
  /** Solo valores escalares y sin datos personales. */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuditRow extends AuditEntry {
  id: Uuid;
  occurredAt: Date;
}

export interface AuditLog {
  record(entry: AuditEntry, id: Uuid, now: Date): Promise<void>;
  list(
    organizationId: Uuid,
    filter: { action?: string; from?: Date; to?: Date },
    limit: number,
    after: { occurredAt: string; id: string } | null,
  ): Promise<AuditRow[]>;
}
