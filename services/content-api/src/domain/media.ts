import {
  AppError,
  invalidTransition,
  validationFailed,
  type Uuid,
} from '@incubaunas/shared-kernel';

export type MediaState = 'pending' | 'scanning' | 'ready' | 'quarantined';

const TRANSITIONS: Readonly<Record<MediaState, readonly MediaState[]>> = {
  pending: ['scanning'],
  scanning: ['ready', 'quarantined'],
  ready: [],
  quarantined: [],
};

export const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
] as const;
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export interface MediaSnapshot {
  id: Uuid;
  organizationId: Uuid;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  altText: string | null;
  storageKey: string;
  state: MediaState;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Nombre de archivo sin ruta ni caracteres de control. */
export function sanitizeFileName(name: string): string {
  const base = name
    .replace(/[\\/]/g, '_')
    .replace(/\p{Cc}/gu, '')
    .trim();
  return base.slice(0, 200) || 'archivo';
}

export function newMedia(
  input: {
    id: Uuid;
    organizationId: Uuid;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    altText?: string;
  },
  now: Date,
): MediaSnapshot {
  const isImage = input.mimeType.startsWith('image/');
  // Una imagen pública sin texto alternativo no es accesible: se exige desde la subida.
  if (isImage && !input.altText?.trim()) {
    throw validationFailed('Las imágenes públicas exigen texto alternativo.', [
      {
        pointer: '/alt_text',
        code: 'required',
        message: 'Describe la imagen para lectores de pantalla.',
      },
    ]);
  }
  return {
    id: input.id,
    organizationId: input.organizationId,
    fileName: sanitizeFileName(input.fileName),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    altText: input.altText?.trim() || null,
    // La clave de almacenamiento nunca incluye el nombre que eligió el usuario.
    storageKey: `org/${input.organizationId}/media/${input.id}`,
    state: 'pending',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionMedia(media: MediaSnapshot, next: MediaState, now: Date): MediaSnapshot {
  if (!TRANSITIONS[media.state].includes(next))
    throw invalidTransition('El medio', media.state, next);
  return { ...media, state: next, updatedAt: now };
}

/** Solo un medio `ready` puede aparecer en una página publicada. */
export function assertUsable(media: Pick<MediaSnapshot, 'id' | 'state'>): void {
  if (media.state === 'quarantined') {
    throw new AppError(
      'media_quarantined',
      409,
      `El medio ${media.id} está en cuarentena y no se puede publicar.`,
    );
  }
  if (media.state !== 'ready') {
    throw new AppError(
      'media_not_ready',
      409,
      `El medio ${media.id} aún no terminó de escanearse.`,
    );
  }
}
