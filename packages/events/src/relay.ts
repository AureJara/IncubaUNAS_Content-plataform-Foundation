import type { Pool } from '@incubaunas/db';
import { withTransaction } from '@incubaunas/db';
import { systemClock, type Clock } from '@incubaunas/shared-kernel';
import type { EventEnvelope } from './envelope.js';
import type { EventPublisher } from './ports.js';

export interface RelayOptions {
  clock?: Clock;
  batchSize?: number;
  /** Tras este número de intentos fallidos el mensaje pasa a `dead` (DLQ) y requiere intervención. */
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  random?: () => number;
}

export interface RelayTickResult {
  published: number;
  retried: number;
  dead: number;
}

interface OutboxRow {
  id: string;
  attempts: number;
  payload: EventEnvelope;
}

/**
 * Lee el outbox y publica en orden de inserción. `for update skip locked` permite varias réplicas
 * del relay sin duplicar trabajo. La entrega es al menos una vez: los consumidores deduplican por
 * `domain_event_id`.
 */
export class OutboxRelay {
  private readonly clock: Clock;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly random: () => number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly pool: Pool,
    private readonly publisher: EventPublisher,
    options: RelayOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.batchSize = options.batchSize ?? 50;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 5 * 60_000;
    this.random = options.random ?? Math.random;
  }

  async tick(): Promise<RelayTickResult> {
    return withTransaction(this.pool, async (client) => {
      const now = this.clock.now();
      const { rows } = await client.query<OutboxRow>(
        `select id, attempts, payload from outbox
          where status = 'pending' and available_at <= $1
          order by id
          limit $2
          for update skip locked`,
        [now, this.batchSize],
      );

      const result: RelayTickResult = { published: 0, retried: 0, dead: 0 };
      for (const row of rows) {
        try {
          await this.publisher.publish({ ...row.payload, published_at: now.toISOString() });
          await client.query(
            `update outbox set status = 'published', published_at = $2, attempts = attempts + 1 where id = $1`,
            [row.id, now],
          );
          result.published += 1;
        } catch (error) {
          const attempts = row.attempts + 1;
          const dead = attempts >= this.maxAttempts;
          await client.query(
            `update outbox set status = $2, attempts = $3, available_at = $4, last_error = $5 where id = $1`,
            [
              row.id,
              dead ? 'dead' : 'pending',
              attempts,
              new Date(now.getTime() + this.backoffMs(attempts)),
              // Solo el mensaje del error: nunca el payload, que podría llevar datos sensibles.
              (error instanceof Error ? error.message : String(error)).slice(0, 500),
            ],
          );
          if (dead) result.dead += 1;
          else result.retried += 1;
        }
      }
      return result;
    });
  }

  /** Backoff exponencial con jitter completo. */
  private backoffMs(attempts: number): number {
    const ceiling = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** (attempts - 1));
    return Math.floor(this.random() * ceiling);
  }

  start(intervalMs = 1_000, onError: (error: unknown) => void = console.error): void {
    if (this.timer) return;
    const loop = async () => {
      try {
        await this.tick();
      } catch (error) {
        onError(error);
      }
      if (this.timer) this.timer = setTimeout(loop, intervalMs);
    };
    this.timer = setTimeout(loop, intervalMs);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
