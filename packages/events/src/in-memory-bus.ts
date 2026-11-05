import type { EventEnvelope } from './envelope.js';
import type { EventHandler, EventPublisher, EventSubscriber } from './ports.js';

/**
 * Bus en memoria para pruebas y desarrollo de un solo proceso. Entrega a todos los suscriptores del
 * topic y propaga el primer error, como lo haría un broker con reintento.
 */
export class InMemoryEventBus implements EventPublisher, EventSubscriber {
  private readonly handlers = new Map<string, { consumerName: string; handler: EventHandler }[]>();
  readonly published: EventEnvelope[] = [];

  subscribe(topic: string, consumerName: string, handler: EventHandler): void {
    const list = this.handlers.get(topic) ?? [];
    list.push({ consumerName, handler });
    this.handlers.set(topic, list);
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    this.published.push(envelope);
    for (const { handler } of this.handlers.get(envelope.topic) ?? []) await handler(envelope);
  }
}
