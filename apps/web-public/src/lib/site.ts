import { MEDIA_BASE_URL, SITE_SLUG } from 'astro:env/server';
import { getSite, UpstreamError, type PublicSite } from './api.js';

/**
 * Sitio que sirve este despliegue. La resolución dominio → sitio (PF-022) la hará el gateway o un
 * paso previo con la Platform API; mientras tanto cada despliegue sirve un solo sitio.
 */
export function siteSlug(): string {
  return SITE_SLUG;
}

export const mediaUrl = (mediaId: string): string | null =>
  MEDIA_BASE_URL ? `${MEDIA_BASE_URL.replace(/\/$/, '')}/${mediaId}` : null;

/**
 * Sitio publicado en el CMS (nombre, menú, tema). Lo usan las páginas estáticas del diseño para
 * heredar el menú y la marca; si la API no responde, la página sigue sirviéndose con los valores del diseño.
 */
export async function loadSite(): Promise<PublicSite | null> {
  try {
    return (await getSite(siteSlug())).data;
  } catch (error) {
    if (error instanceof UpstreamError) return null;
    throw error;
  }
}
