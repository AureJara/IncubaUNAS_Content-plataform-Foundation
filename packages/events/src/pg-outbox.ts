import type { DbClient } from '@incubaunas/db';
import type { Clock } from '@incubaunas/shared-kernel';
import type { EventContractValidator } from './contract-validator.js';
import type { EventEnvelope } from './envelope.js';
import type { InboxStore, OutboxWriter } from './ports.js';

/**
 * Outbox sobre la transacción en curso: el cambio de negocio y su evento se confirman juntos o no se
 * confirma ninguno. Valida el contrato antes de escribir, así un evento inválido nunca sale.
 */
export class PgOutboxWriter implements OutboxWriter {
  constructor(
    private readonly client: DbClient,
    private readonly validator: EventContractValidator,
    private readonly clock: Clock,
  ) {}

  async append(envelope: EventEnvelope): Promise<void> {
    this.validator.assertValid(envelope);
    const now = this.clock.now();
    await this.client.query(
      `insert into outbox (domain_event_id, message_id, topic, organization_id, partition_key,
                           aggregate_type, aggregate_id, aggregate_version, payload, occurred_at,
                           available_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [
        envelope.domain_event_id,
        envelope.message_id,
        envelope.topic,
        envelope.organization_id,
        envelope.partition_key,
        envelope.aggregate.type,
        envelope.aggregate.id,
        envelope.aggregate.version,
        JSON.stringify(envelope),
        envelope.occurred_at,
        now,
      ],
    );
  }
}

/** Inbox sobre la transacción del consumidor: la proyección y el "ya procesado" se confirman juntos. */
export class PgInboxStore implements InboxStore {
  constructor(
    private readonly client: DbClient,
    private readonly clock: Clock,
  ) {}

  async claim(consumerName: string, envelope: EventEnvelope): Promise<boolean> {
    const result = await this.client.query(
      `insert into inbox (consumer_name, domain_event_id, organization_id, topic, aggregate_id,
                          aggregate_version, processed_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (consumer_name, domain_event_id) do nothing`,
      [
        consumerName,
        envelope.domain_event_id,
        envelope.organization_id,
        envelope.topic,
        envelope.aggregate.id,
        envelope.aggregate.version,
        this.clock.now(),
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
