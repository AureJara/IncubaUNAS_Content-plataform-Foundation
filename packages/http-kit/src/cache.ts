import type { FastifyReply, FastifyRequest } from 'fastify';
import { sha256Hex } from '@incubaunas/shared-kernel';

export interface PublicCachePolicy {
  /** Frescura en navegadores, en segundos. */
  maxAge: number;
  /** Frescura en CDN, en segundos. */
  sMaxAge: number;
  staleWhileRevalidate?: number;
  /** Claves de purga selectiva en el CDN (header `Surrogate-Key`). */
  surrogateKeys: readonly string[];
  vary?: readonly string[];
}

/** ETag fuerte derivado del contenido: dos respuestas iguales comparten ETag. */
export const contentEtag = (body: unknown): string =>
  `"${sha256Hex(JSON.stringify(body)).slice(0, 32)}"`;

/**
 * Respuesta pública cacheable con ETag y `304`. No se llama nunca en rutas con cookie o con
 * credenciales: las respuestas privadas son `no-store`.
 */
export function sendPublicCacheable(
  request: FastifyRequest,
  reply: FastifyReply,
  body: unknown,
  policy: PublicCachePolicy,
): FastifyReply {
  const etag = contentEtag(body);
  const swr = policy.staleWhileRevalidate
    ? `, stale-while-revalidate=${policy.staleWhileRevalidate}`
    : '';
  reply
    .header('etag', etag)
    .header('cache-control', `public, max-age=${policy.maxAge}, s-maxage=${policy.sMaxAge}${swr}`)
    .header('vary', (policy.vary ?? ['Accept-Encoding']).join(', '))
    .header('surrogate-key', policy.surrogateKeys.join(' '));

  if (request.headers['if-none-match'] === etag) return reply.status(304).send();
  return reply.send(body);
}

export const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store');
