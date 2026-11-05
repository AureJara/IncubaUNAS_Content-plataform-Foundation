import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withTransaction, type Pool } from '@incubaunas/db';
import { FixedClock } from '@incubaunas/shared-kernel';
import {
  ContractViolationError,
  EventContractValidator,
  InMemoryEventBus,
  OutboxRelay,
  PgInboxStore,
  PgOutboxWriter,
  buildEnvelope,
  isNewerThan,
  type EventEnvelope,
} from '../src/index.js';

const examples = JSON.parse(
  readFileSync(
    new URL('../../../contracts/examples/events.examples.json', import.meta.url),
    'utf8',
  ),
) as Record<string, EventEnvelope>;

const ORG = '0192f3a0-0000-7000-8000-0000000000a1';
const validator = new EventContractValidator();

const lifecycleEvent = (clock: FixedClock) =>
  buildEnvelope(
    {
      topic: 'platform.organization.lifecycle_changed.v1',
      producer: 'platform',
      organizationId: ORG,
      aggregate: { type: 'organization', id: ORG, version: 2 },
      actor: { type: 'system', id: 'system:test' },
      occurredAt: clock.now(),
      data: {
        organization_id: ORG,
        previous_state: 'provisioning',
        current_state: 'active',
        effective_at: clock.now().toISOString(),
      },
    },
    { clock },
  );

describe('contrato de eventos', () => {
  it('acepta todos los ejemplos oficiales', () => {
    for (const example of Object.values(examples))
      expect(() => validator.assertValid(example)).not.toThrow();
  });

  it('buildEnvelope produce un mensaje que cumple el contrato', () => {
    const envelope = lifecycleEvent(new FixedClock(new Date('2026-11-04T15:00:00Z')));
    expect(() => validator.assertValid(envelope)).not.toThrow();
    expect(envelope.partition_key).toBe(`${ORG}:${ORG}`);
    expect(envelope.schema_version).toBe(1);
  });

  it('rechaza un topic sin schema, un campo personal y un estado inventado', () => {
    const base = lifecycleEvent(new FixedClock(new Date('2026-11-04T15:00:00Z')));
    expect(() => validator.assertValid({ ...base, topic: 'platform.nope.v1' })).toThrow(
      ContractViolationError,
    );
    expect(() =>
      validator.assertValid({ ...base, data: { ...base.data, email: 'a@b.test' } }),
    ).toThrow(ContractViolationError);
    expect(() =>
      validator.assertValid({ ...base, data: { ...base.data, current_state: 'zombie' } }),
    ).toThrow(ContractViolationError);
  });
});

describe('orden por versión de agregado', () => {
  it('descarta mensajes viejos o repetidos', () => {
    expect(isNewerThan(null, 1)).toBe(true);
    expect(isNewerThan(3, 4)).toBe(true);
    expect(isNewerThan(3, 3)).toBe(false);
    expect(isNewerThan(3, 2)).toBe(false);
  });
});

const adminUrl = process.env.PLATFORM_DATABASE_ADMIN_URL;
if (!adminUrl && process.env.CI) throw new Error('CI exige PLATFORM_DATABASE_ADMIN_URL');

describe.skipIf(!adminUrl)('outbox, relay e inbox (PostgreSQL)', () => {
  const schema = `events_test_${Date.now()}`;
  let admin: pg.Client;
  let pool: Pool;
  const clock = new FixedClock(new Date('2026-11-04T15:00:00Z'));

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create schema ${schema}`);
    const url = new URL(adminUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    pool = createPool({ connectionString: url.toString(), max: 4 });
    await pool.query(readFileSync(new URL('../sql/outbox_inbox.sql', import.meta.url), 'utf8'));
  });

  afterAll(async () => {
    await pool.end();
    await admin.query(`drop schema ${schema} cascade`);
    await admin.end();
  });

  const append = (envelope: EventEnvelope) =>
    withTransaction(pool, (client) =>
      new PgOutboxWriter(client, validator, clock).append(envelope),
    );

  it('publica en orden y marca como publicado', async () => {
    const first = lifecycleEvent(clock);
    const second = lifecycleEvent(clock);
    await append(first);
    await append(second);

    const bus = new InMemoryEventBus();
    const result = await new OutboxRelay(pool, bus, { clock }).tick();

    expect(result).toEqual({ published: 2, retried: 0, dead: 0 });
    expect(bus.published.map((m) => m.domain_event_id)).toEqual([
      first.domain_event_id,
      second.domain_event_id,
    ]);
    expect((await new OutboxRelay(pool, bus, { clock }).tick()).published).toBe(0);
  });

  it('no deja salir un evento que viola su contrato y revierte la transacción', async () => {
    const invalid = {
      ...lifecycleEvent(clock),
      data: { organization_id: ORG },
    } as unknown as EventEnvelope;
    await expect(append(invalid)).rejects.toBeInstanceOf(ContractViolationError);
    const { rows } = await pool.query(
      `select count(*)::int as n from outbox where domain_event_id = $1`,
      [invalid.domain_event_id],
    );
    expect(rows[0].n).toBe(0);
  });

  it('el evento y el cambio de negocio se confirman juntos o ninguno', async () => {
    await pool.query('create table if not exists cambios (id int primary key)');
    const envelope = lifecycleEvent(clock);
    await expect(
      withTransaction(pool, async (client) => {
        await client.query('insert into cambios (id) values (1)');
        await new PgOutboxWriter(client, validator, clock).append(envelope);
        throw new Error('falla después del evento');
      }),
    ).rejects.toThrow('falla');

    const { rows } = await pool.query(
      `select (select count(*) from cambios)::int as cambios,
              (select count(*) from outbox where domain_event_id = $1)::int as eventos`,
      [envelope.domain_event_id],
    );
    expect(rows[0]).toEqual({ cambios: 0, eventos: 0 });
  });

  it('reintenta con backoff y manda a DLQ al agotar los intentos', async () => {
    const envelope = lifecycleEvent(clock);
    await append(envelope);

    const failing = { publish: async () => Promise.reject(new Error('broker caído')) };
    const relay = new OutboxRelay(pool, failing, {
      clock,
      maxAttempts: 3,
      baseBackoffMs: 1000,
      random: () => 1,
    });

    expect(await relay.tick()).toEqual({ published: 0, retried: 1, dead: 0 });
    // Aún no vence el backoff: el mensaje no se vuelve a intentar.
    expect(await relay.tick()).toEqual({ published: 0, retried: 0, dead: 0 });

    clock.advanceSeconds(5);
    expect(await relay.tick()).toEqual({ published: 0, retried: 1, dead: 0 });
    clock.advanceSeconds(10);
    expect(await relay.tick()).toEqual({ published: 0, retried: 0, dead: 1 });

    const { rows } = await pool.query(
      `select status, attempts, last_error from outbox where domain_event_id = $1`,
      [envelope.domain_event_id],
    );
    expect(rows[0]).toEqual({ status: 'dead', attempts: 3, last_error: 'broker caído' });
  });

  it('el inbox hace idempotente a un consumidor ante entrega duplicada', async () => {
    const envelope = lifecycleEvent(clock);
    const consume = () =>
      withTransaction(pool, (client) =>
        new PgInboxStore(client, clock).claim('content-projection', envelope),
      );

    expect(await consume()).toBe(true);
    expect(await consume()).toBe(false);
  });
});
