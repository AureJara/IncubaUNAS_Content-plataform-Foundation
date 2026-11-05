import { AppError, notFound, validationFailed, type Uuid } from '@incubaunas/shared-kernel';
import { runIdempotent } from '@incubaunas/service-kit';
import type { RequestContext } from '@incubaunas/tenancy';
import { ALLOWED_MIME, MAX_MEDIA_BYTES, newMedia, transitionMedia } from '../domain/media.js';
import { ownTenant, recordAudit, type ContentDeps } from './deps.js';
import { toMediaDto } from './dto.js';

const UPLOAD_TTL_MS = 15 * 60 * 1000;

export interface MediaUploadInput {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  alt_text?: string;
}

/** PF-032: subida firmada, validación de tipo/tamaño/hash y escaneo antes de poder publicar. */
export class MediaService {
  constructor(private readonly deps: ContentDeps) {}

  async requestUpload(ctx: RequestContext, input: MediaUploadInput, key: string) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock, ids, storage } = this.deps;

    if (
      !(ALLOWED_MIME as readonly string[]).includes(input.mime_type) ||
      input.size_bytes > MAX_MEDIA_BYTES
    ) {
      throw validationFailed('El archivo no está permitido.', [
        {
          pointer: '/mime_type',
          code: 'not_allowed',
          message: 'Tipo o tamaño fuera de la política de medios.',
        },
      ]);
    }

    return uow.run({ organizationId }, async (r) => {
      const result = await runIdempotent(
        r.idempotency,
        clock,
        { organizationId, actorId: ctx.actor.id, operation: 'media.request_upload' },
        key,
        input,
        async () => {
          const media = newMedia(
            {
              id: ids.next(),
              organizationId,
              fileName: input.file_name,
              mimeType: input.mime_type,
              sizeBytes: input.size_bytes,
              sha256: input.sha256,
              altText: input.alt_text,
            },
            clock.now(),
          );
          await r.media.insert(media, null);
          await recordAudit(r, this.deps, ctx, {
            organizationId,
            action: 'media.upload_requested',
            target: { type: 'media', id: media.id },
            outcome: 'success',
            metadata: { mime: media.mimeType, bytes: media.sizeBytes },
          });
          return toMediaDto(media);
        },
      );

      // La URL firmada no se guarda con la respuesta repetible: se firma de nuevo en cada llamada.
      const asset = await r.media.findById(result.value.id);
      const upload = await storage.presignUpload({
        key: asset!.storageKey,
        mimeType: asset!.mimeType,
        sizeBytes: asset!.sizeBytes,
        sha256: asset!.sha256,
        expiresAt: new Date(clock.now().getTime() + UPLOAD_TTL_MS),
      });
      return {
        value: {
          asset: result.value,
          upload: {
            ...upload,
            expires_at: new Date(clock.now().getTime() + UPLOAD_TTL_MS).toISOString(),
          },
        },
        replayed: result.replayed,
      };
    });
  }

  async completeUpload(ctx: RequestContext, mediaId: Uuid, sizeBytes: number) {
    ctx.authz.require('sites:write');
    const organizationId = ownTenant(ctx);
    const { uow, clock, storage } = this.deps;

    return uow.run({ organizationId }, async (r) => {
      const media = await r.media.findById(mediaId);
      if (!media) throw notFound('El medio');

      // Se comprueba contra el almacenamiento: lo que declara el cliente no es una fuente de verdad.
      const stored = await storage.head(media.storageKey);
      if (!stored) throw new AppError('media_not_ready', 409, 'El archivo todavía no se subió.');
      if (stored.sizeBytes !== sizeBytes || stored.sizeBytes !== media.sizeBytes) {
        throw validationFailed('El tamaño del archivo no coincide.', [
          {
            pointer: '/size_bytes',
            code: 'mismatch',
            message: 'El archivo subido no es el declarado.',
          },
        ]);
      }
      const scanning = await r.media.update(
        transitionMedia(media, 'scanning', clock.now()),
        media.revision,
      );
      await recordAudit(r, this.deps, ctx, {
        organizationId,
        action: 'media.upload_completed',
        target: { type: 'media', id: mediaId },
        outcome: 'success',
      });
      return toMediaDto(scanning);
    });
  }

  /**
   * Procesa los medios en `scanning`. Lo ejecuta un worker, no la petición HTTP. Sin un escáner real
   * configurado los medios permanecen en `scanning`: nunca se marcan como listos por omisión.
   */
  async runScanBatch(
    organizationId: Uuid,
    limit = 25,
  ): Promise<{ ready: number; quarantined: number }> {
    const { uow, clock, scanner, ids } = this.deps;
    return uow.run({ organizationId }, async (r) => {
      const result = { ready: 0, quarantined: 0 };
      for (const media of await r.media.listByState('scanning', limit)) {
        const verdict = await scanner.scan({
          storageKey: media.storageKey,
          mimeType: media.mimeType,
          sha256: media.sha256,
        });
        const next = verdict === 'clean' ? 'ready' : 'quarantined';
        await r.media.update(transitionMedia(media, next, clock.now()), media.revision);
        await r.audit.record(
          {
            organizationId,
            actor: { type: 'system', id: 'system:media-scanner' },
            action: `media.${next}`,
            target: { type: 'media', id: media.id },
            outcome: verdict === 'clean' ? 'success' : 'denied',
            requestId: ids.next(),
          },
          ids.next(),
          clock.now(),
        );
        result[next] += 1;
      }
      return result;
    });
  }
}
