import { createHash } from 'node:crypto';
import type { Clock } from '@incuba/shared-kernel';
import { HttpProblem } from './problem.ts';

/** Respuesta guardada para repetirla con la misma clave (RN-22). */
export interface StoredResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type IdempotencyBegin =
  | { outcome: 'started' }
  | { outcome: 'replay'; response: StoredResponse }
  | { outcome: 'mismatch' }
  | { outcome: 'in_progress' };

/**
 * Puerto de idempotencia. La clave se guarda por `scope` (organización, actor y operación: spec 10.1) durante al menos
 * 24 h. La implementación de PostgreSQL llega con F0-07; aquí está la de memoria (spec 3.8).
 */
export interface IdempotencyStore {
  begin(scope: string, key: string, requestHash: string): Promise<IdempotencyBegin>;
  complete(scope: string, key: string, response: StoredResponse): Promise<void>;
  /** Libera la clave cuando la operación falla, para poder reintentar. */
  abort(scope: string, key: string): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface Entry {
  requestHash: string;
  response: StoredResponse | undefined;
  expiresAt: number;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  readonly #entries = new Map<string, Entry>();
  readonly #clock: Clock;
  readonly #ttlMs: number;

  constructor(clock: Clock, ttlMs = DAY_MS) {
    this.#clock = clock;
    this.#ttlMs = ttlMs;
  }

  async begin(scope: string, key: string, requestHash: string): Promise<IdempotencyBegin> {
    const id = `${scope}\u0000${key}`;
    const now = this.#clock.now().getTime();
    const entry = this.#entries.get(id);
    if (entry && entry.expiresAt > now) {
      if (entry.requestHash !== requestHash) return { outcome: 'mismatch' };
      return entry.response ? { outcome: 'replay', response: entry.response } : { outcome: 'in_progress' };
    }
    this.#entries.set(id, { requestHash, response: undefined, expiresAt: now + this.#ttlMs });
    return { outcome: 'started' };
  }

  async complete(scope: string, key: string, response: StoredResponse): Promise<void> {
    const entry = this.#entries.get(`${scope}\u0000${key}`);
    if (entry) entry.response = structuredClone(response);
  }

  async abort(scope: string, key: string): Promise<void> {
    this.#entries.delete(`${scope}\u0000${key}`);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Hash del request: el mismo cuerpo con las claves en otro orden produce el mismo hash. */
export function requestHash(body: unknown): string {
  return createHash('sha256').update(canonicalJson(body)).digest('hex');
}

/**
 * Ejecuta un comando una sola vez por clave (RN-22): misma clave y mismo cuerpo → misma respuesta; misma clave y otro
 * cuerpo → 409 `idempotency_key_reused`. Solo se guardan las respuestas exitosas; si el comando falla, la clave se
 * libera.
 */
export async function withIdempotency<R extends StoredResponse>(
  store: IdempotencyStore,
  input: { scope: string; key: string; body: unknown },
  run: () => Promise<R>,
): Promise<R> {
  const begun = await store.begin(input.scope, input.key, requestHash(input.body));
  switch (begun.outcome) {
    case 'replay':
      // La tienda guarda la respuesta completa que devolvió `run`.
      return begun.response as R;
    case 'mismatch':
      throw new HttpProblem({
        status: 409,
        code: 'idempotency_key_reused',
        detail: 'La Idempotency-Key ya se usó con otro cuerpo.',
      });
    case 'in_progress':
      throw new HttpProblem({
        status: 409,
        code: 'request_in_progress',
        detail: 'Hay una solicitud en curso con la misma Idempotency-Key.',
      });
    case 'started':
      break;
  }
  try {
    const response = await run();
    if (response.status >= 200 && response.status < 300) {
      await store.complete(input.scope, input.key, response);
    } else {
      await store.abort(input.scope, input.key);
    }
    return response;
  } catch (error) {
    await store.abort(input.scope, input.key);
    throw error;
  }
}
