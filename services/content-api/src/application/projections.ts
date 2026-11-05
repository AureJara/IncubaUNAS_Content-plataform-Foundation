import { contentHash, type Uuid } from '@incubaunas/shared-kernel';
import { Ajv2020, addFormats } from '@incubaunas/shared-kernel';
import { isNewerThan, type EventEnvelope, type EventSubscriber } from '@incubaunas/events';
import type { ContentDeps } from './deps.js';
import type { PublicEventRow, Repositories } from './ports.js';

const CONSUMER = 'content-event-projection';

interface ReleaseData {
  event_id: Uuid;
  publication_id: Uuid;
  release_version: number;
  manifest_ref: string;
  manifest_hash: string;
  effective_at: string;
}

interface Manifest {
  event: {
    id: Uuid;
    site_id: Uuid;
    slug: string;
    title: string;
    kind: string;
    description?: string | null;
    starts_at: string;
    ends_at: string;
    timezone: string;
    status: PublicEventRow['status'];
  };
  programs: unknown[];
  sessions: unknown[];
}

/**
 * Proyección pública de eventos (PF-037, PF-042). Consume los eventos de Configuration y de
 * Participation y mantiene el modelo de lectura que usan las landings.
 *
 * Reglas del contrato: una release se carga como `pending` y se activa solo si el manifiesto está
 * completo y es válido; nunca se mezclan versiones; el orden lo da `aggregate.version`; y un mensaje
 * repetido no tiene efecto (inbox).
 */
export class EventProjectionService {
  private readonly validateManifest;

  constructor(
    private readonly deps: ContentDeps,
    manifestSchema: object,
  ) {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    this.validateManifest = ajv.compile(manifestSchema);
  }

  register(subscriber: EventSubscriber): void {
    subscriber.subscribe('configuration.event.release_published.v1', CONSUMER, (m) =>
      this.onReleasePublished(m),
    );
    subscriber.subscribe('configuration.event.cancelled.v1', CONSUMER, (m) =>
      this.onEventCancelled(m),
    );
    subscriber.subscribe('configuration.schedule.changed.v1', CONSUMER, (m) =>
      this.onScheduleChanged(m),
    );
    subscriber.subscribe('participation.availability.changed.v1', CONSUMER, (m) =>
      this.onAvailabilityChanged(m),
    );
  }

  async onReleasePublished(envelope: EventEnvelope): Promise<void> {
    const data = envelope.data as unknown as ReleaseData;
    const { uow, clock, fetcher } = this.deps;

    // El manifiesto se descarga FUERA de la transacción; si falla por red, el broker reintenta.
    const manifest = await fetcher.fetch(data.manifest_ref);

    await uow.run({ organizationId: envelope.organization_id }, async (r) => {
      if (!(await r.inbox.claim(CONSUMER, envelope))) return; // reentrega: ya se procesó

      const latest = await r.eventReleases.latestAggregateVersion(data.event_id);
      if (!isNewerThan(latest, envelope.aggregate.version)) return; // llegó fuera de orden: se descarta

      const now = clock.now();
      const inserted = await r.eventReleases.insertPending(
        {
          id: data.publication_id,
          organizationId: envelope.organization_id,
          eventId: data.event_id,
          releaseVersion: data.release_version,
          status: 'pending',
          manifest,
          manifestHash: data.manifest_hash,
          aggregateVersion: envelope.aggregate.version,
          error: null,
        },
        now,
      );
      if (!inserted) return;

      const problem = await this.manifestProblem(r, envelope, data, manifest);
      if (problem) {
        // Una release incompleta o inválida nunca se hace visible; queda registrada como fallida.
        await r.eventReleases.markFailed(data.publication_id, problem);
        return;
      }

      const m = manifest as Manifest;
      await r.publicWriter.upsertEvent(
        {
          eventId: m.event.id,
          siteId: m.event.site_id,
          organizationId: envelope.organization_id,
          slug: m.event.slug,
          title: m.event.title,
          kind: m.event.kind,
          description: m.event.description ?? null,
          startsAt: new Date(m.event.starts_at),
          endsAt: new Date(m.event.ends_at),
          timezone: m.event.timezone,
          status: m.event.status,
          publicationId: data.publication_id,
          releaseVersion: data.release_version,
          programs: m.programs,
          sessions: m.sessions,
        },
        now,
      );
      await r.eventReleases.activate(data.publication_id, m.event.id, now);
    });
  }

  async onEventCancelled(envelope: EventEnvelope): Promise<void> {
    const data = envelope.data as { event_id: Uuid };
    await this.deps.uow.run({ organizationId: envelope.organization_id }, async (r) => {
      if (!(await r.inbox.claim(CONSUMER, envelope))) return;
      await r.publicWriter.markEventStatus(data.event_id, 'cancelled', this.deps.clock.now());
    });
  }

  /** Un cambio de agenda llega siempre acompañado de una release nueva: aquí solo se registra. */
  async onScheduleChanged(envelope: EventEnvelope): Promise<void> {
    await this.deps.uow.run({ organizationId: envelope.organization_id }, async (r) => {
      await r.inbox.claim(CONSUMER, envelope);
    });
  }

  async onAvailabilityChanged(envelope: EventEnvelope): Promise<void> {
    const data = envelope.data as {
      event_id: Uuid;
      public_state: 'not_open' | 'open' | 'waitlist_only' | 'closed';
      remaining_band: 'plenty' | 'few' | 'none' | null;
      as_of: string;
    };
    await this.deps.uow.run({ organizationId: envelope.organization_id }, async (r) => {
      if (!(await r.inbox.claim(CONSUMER, envelope))) return;
      await r.publicWriter.upsertAvailability({
        eventId: data.event_id,
        publicState: data.public_state,
        remainingBand: data.remaining_band,
        asOf: new Date(data.as_of),
      });
    });
  }

  /** Devuelve el motivo por el que la release no se puede activar, o `null` si es válida. */
  private async manifestProblem(
    r: Repositories,
    envelope: EventEnvelope,
    data: ReleaseData,
    manifest: unknown,
  ): Promise<string | null> {
    if (!this.validateManifest(manifest)) return 'manifest_invalid';
    const m = manifest as Manifest;
    if (contentHash(manifest) !== data.manifest_hash) return 'manifest_hash_mismatch';
    if (m.event.id !== data.event_id) return 'event_mismatch';
    // El sitio del manifiesto debe pertenecer a la misma organización del mensaje (RLS lo filtra).
    const site = await r.sites.findById(m.event.site_id);
    if (!site || site.organizationId !== envelope.organization_id) return 'site_not_found';
    return null;
  }
}
