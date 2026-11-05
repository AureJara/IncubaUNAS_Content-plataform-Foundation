import type { EventEnvelope } from './envelope.js';

/** Escribe un evento en el outbox dentro de la misma transacción que el cambio de negocio. */
export interface OutboxWriter {
  append(envelope: EventEnvelope): Promise<void>;
}

/** Entrega un mensaje al bus. El broker concreto es una decisión pendiente; el contrato no depende de él. */
export interface EventPublisher {
  publish(envelope: EventEnvelope): Promise<void>;
}

export type EventHandler = (envelope: EventEnvelope) => Promise<void>;

export interface EventSubscriber {
  subscribe(topic: string, consumerName: string, handler: EventHandler): void;
}

/** Garantiza efecto único por `(consumer, domain_event_id)` con entrega al menos una vez. */
export interface InboxStore {
  /** `true` la primera vez; `false` si ya se procesó (el duplicado se considera éxito). */
  claim(consumerName: string, envelope: EventEnvelope): Promise<boolean>;
}

/** Solo aplica un mensaje si es más nuevo que el último visto para ese agregado. */
export const isNewerThan = (lastVersion: number | null | undefined, incoming: number): boolean =>
  lastVersion === null || lastVersion === undefined || incoming > lastVersion;
