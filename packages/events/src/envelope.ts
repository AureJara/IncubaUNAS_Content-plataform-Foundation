import { randomBytes } from 'node:crypto';
import {
  systemClock,
  uuidV7Generator,
  type Clock,
  type IdGenerator,
  type Uuid,
} from '@incubaunas/shared-kernel';

export type Producer =
  'platform' | 'content' | 'configuration' | 'participation' | 'onsite' | 'operations';

export interface EventActorRef {
  type: 'user' | 'service' | 'system';
  id: string;
}

export interface AggregateRef {
  type: string;
  id: Uuid;
  /** Versión del agregado: ordena los replays y descarta mensajes viejos. */
  version: number;
}

/** Envelope canónico v1 (contracts/schemas/envelope.v1.json). */
export interface EventEnvelope<TData = Record<string, unknown>> {
  message_id: Uuid;
  domain_event_id: Uuid;
  topic: string;
  schema_version: number;
  producer: Producer;
  organization_id: Uuid;
  business_event_id: Uuid;
  occurred_at: string;
  published_at: string;
  actor: EventActorRef;
  traceparent: string;
  correlation_id: Uuid;
  causation_id?: Uuid;
  aggregate: AggregateRef;
  partition_key: string;
  data: TData;
}

export interface NewEvent<TData> {
  topic: string;
  producer: Producer;
  organizationId: Uuid;
  /** Si el hecho no pertenece a un evento de negocio, se usa el id de la organización. */
  businessEventId?: Uuid;
  aggregate: AggregateRef;
  actor: EventActorRef;
  occurredAt: Date;
  correlationId?: Uuid;
  causationId?: Uuid;
  traceparent?: string;
  data: TData;
}

export interface EnvelopeDeps {
  ids?: IdGenerator;
  clock?: Clock;
}

export const newTraceparent = (): string =>
  `00-${randomBytes(16).toString('hex')}-${randomBytes(8).toString('hex')}-01`;

export function schemaVersionOf(topic: string): number {
  const match = /\.v(\d+)$/.exec(topic);
  if (!match) throw new Error(`El topic "${topic}" no termina en una versión (.vN).`);
  return Number(match[1]);
}

export const partitionKeyFor = (organizationId: Uuid, businessEventId: Uuid): string =>
  `${organizationId}:${businessEventId}`;

export function buildEnvelope<TData>(
  input: NewEvent<TData>,
  deps: EnvelopeDeps = {},
): EventEnvelope<TData> {
  const ids = deps.ids ?? uuidV7Generator;
  const clock = deps.clock ?? systemClock;
  const businessEventId = input.businessEventId ?? input.organizationId;
  const messageId = ids.next();
  return {
    message_id: messageId,
    domain_event_id: ids.next(),
    topic: input.topic,
    schema_version: schemaVersionOf(input.topic),
    producer: input.producer,
    organization_id: input.organizationId,
    business_event_id: businessEventId,
    occurred_at: input.occurredAt.toISOString(),
    published_at: clock.now().toISOString(),
    actor: input.actor,
    traceparent: input.traceparent ?? newTraceparent(),
    correlation_id: input.correlationId ?? ids.next(),
    ...(input.causationId ? { causation_id: input.causationId } : {}),
    aggregate: input.aggregate,
    partition_key: partitionKeyFor(input.organizationId, businessEventId),
    data: input.data,
  };
}
