import { describe, expect, it } from 'vitest';
import { FixedClock } from '@incubaunas/shared-kernel';
import {
  runIdempotent,
  type IdempotencyScope,
  type IdempotencyStore,
  type StoredResponse,
} from '../src/index.js';

class MemoryStore implements IdempotencyStore {
  readonly rows = new Map<string, StoredResponse>();
  private id = (scope: IdempotencyScope, key: string) =>
    [scope.organizationId, scope.actorId, scope.operation, key].join('|');

  async find(scope: IdempotencyScope, key: string) {
    return this.rows.get(this.id(scope, key)) ?? null;
  }

  async save(scope: IdempotencyScope, key: string, stored: StoredResponse) {
    this.rows.set(this.id(scope, key), stored);
  }
}

const scope: IdempotencyScope = {
  organizationId: 'org-1',
  actorId: 'user-1',
  operation: 'site.create',
};
const clock = new FixedClock(new Date('2026-11-04T12:00:00Z'));

describe('runIdempotent', () => {
  it('ejecuta el comando una sola vez y reproduce la respuesta guardada', async () => {
    const store = new MemoryStore();
    let executions = 0;
    const work = async () => ({ id: ++executions });

    const first = await runIdempotent(store, clock, scope, 'k1', { a: 1 }, work);
    const second = await runIdempotent(store, clock, scope, 'k1', { a: 1 }, work);

    expect(first).toEqual({ value: { id: 1 }, replayed: false });
    expect(second).toEqual({ value: { id: 1 }, replayed: true });
    expect(executions).toBe(1);
  });

  it('el orden de las claves del cuerpo no cambia la huella de la petición', async () => {
    const store = new MemoryStore();
    await runIdempotent(store, clock, scope, 'k1', { a: 1, b: 2 }, async () => 'ok');
    const replay = await runIdempotent(
      store,
      clock,
      scope,
      'k1',
      { b: 2, a: 1 },
      async () => 'otro',
    );
    expect(replay.replayed).toBe(true);
  });

  it('la misma clave con otro cuerpo devuelve 409 idempotency_key_reused', async () => {
    const store = new MemoryStore();
    await runIdempotent(store, clock, scope, 'k1', { a: 1 }, async () => 'ok');
    await expect(
      runIdempotent(store, clock, scope, 'k1', { a: 2 }, async () => 'ok'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'idempotency_key_reused',
    });
  });

  it('un comando que falla no se guarda: el reintento vuelve a ejecutarse', async () => {
    const store = new MemoryStore();
    await expect(
      runIdempotent(store, clock, scope, 'k1', {}, async () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(store.rows.size).toBe(0);

    const retry = await runIdempotent(store, clock, scope, 'k1', {}, async () => 'recuperado');
    expect(retry).toEqual({ value: 'recuperado', replayed: false });
  });

  it('la clave solo vale dentro de su organización, actor y operación', async () => {
    const store = new MemoryStore();
    await runIdempotent(store, clock, scope, 'k1', {}, async () => 'a');
    const otherOrg = await runIdempotent(
      store,
      clock,
      { ...scope, organizationId: 'org-2' },
      'k1',
      {},
      async () => 'b',
    );
    const otherActor = await runIdempotent(
      store,
      clock,
      { ...scope, actorId: 'user-2' },
      'k1',
      {},
      async () => 'c',
    );
    const otherOperation = await runIdempotent(
      store,
      clock,
      { ...scope, operation: 'page.create' },
      'k1',
      {},
      async () => 'd',
    );

    expect([otherOrg.replayed, otherActor.replayed, otherOperation.replayed]).toEqual([
      false,
      false,
      false,
    ]);
    expect(store.rows.size).toBe(4);
  });
});
