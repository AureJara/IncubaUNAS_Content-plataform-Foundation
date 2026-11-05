import { CONTENT_API_URL } from 'astro:env/server';
import type { components } from './api-types.generated.js';

export type PublicSite = components['schemas']['PublicSite'];
export type PublicPage = components['schemas']['PublicPage'];
export type PublicEvent = components['schemas']['PublicEvent'];
export type PublicEventSummary = components['schemas']['PublicEventSummary'];

const BASE = CONTENT_API_URL.replace(/\/$/, '');
const TIMEOUT_MS = 5_000;

export interface ApiResult<T> {
  /** `null` cuando el recurso no existe (404). */
  data: T | null;
  /** Headers de caché de la API; se reenvían para que el CDN pueda cachear la página. */
  cache: { cacheControl: string | null; surrogateKey: string | null };
}

/** Error de infraestructura (la API no responde o devuelve 5xx): se distingue de un 404 legítimo. */
export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

async function get<T>(path: string): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new UpstreamError(503, 'La API de contenido no responde.');
  }
  const cache = {
    cacheControl: response.headers.get('cache-control'),
    surrogateKey: response.headers.get('surrogate-key'),
  };
  if (response.status === 404) return { data: null, cache };
  if (!response.ok)
    throw new UpstreamError(response.status, `La API de contenido respondió ${response.status}.`);
  return { data: (await response.json()) as T, cache };
}

const seg = encodeURIComponent;

export const getSite = (slug: string) => get<PublicSite>(`/public/v1/sites/${seg(slug)}`);
export const getPage = (slug: string, path: string) =>
  get<PublicPage>(`/public/v1/sites/${seg(slug)}/pages/${seg(path)}`);
export const listEvents = (slug: string) =>
  get<{ items: PublicEventSummary[]; next_cursor: string | null }>(
    `/public/v1/sites/${seg(slug)}/events`,
  );
export const getEvent = (slug: string, eventSlug: string) =>
  get<PublicEvent>(`/public/v1/sites/${seg(slug)}/events/${seg(eventSlug)}`);
export const getPreview = (token: string) =>
  get<components['schemas']['PublicPage'] & { blocks: PublicPage['blocks'] }>(
    `/public/v1/previews/${seg(token)}`,
  );
