// Cabeceras de caché por ruta (FE-05): el `Cache-Control` del recurso principal de la ruta y la unión de los
// `Surrogate-Key` de todo lo que se leyó, para que publicar o despublicar purgue la página en el CDN.
const NO_STORE = 'no-store';

/** Une claves separadas por espacios, sin repetir y en orden estable. */
export function mergeSurrogateKeys(...values: (string | null | undefined)[]): string {
  const keys = new Set<string>();
  for (const value of values) for (const key of value?.split(/\s+/u) ?? []) if (key) keys.add(key);
  return [...keys].join(' ');
}

/** Cabeceras de un loader: la primera respuesta es el recurso principal de la ruta. */
export function cacheHeaders(responses: readonly Response[], extraKeys: (string | null)[] = []): Headers {
  const headers = new Headers();
  const cacheControl = responses[0]?.headers.get('cache-control');
  headers.set('Cache-Control', cacheControl ?? NO_STORE);
  const keys = mergeSurrogateKeys(...extraKeys, ...responses.map((response) => response.headers.get('surrogate-key')));
  if (keys) headers.set('Surrogate-Key', keys);
  return headers;
}

export interface HeadersArgsLike {
  loaderHeaders: Headers;
  parentHeaders: Headers;
  errorHeaders: Headers | undefined;
}

/** `headers` de cada ruta: la hoja manda en `Cache-Control`; las claves se suman. Un error nunca se cachea. */
export function routeHeaders({ loaderHeaders, parentHeaders, errorHeaders }: HeadersArgsLike): Headers {
  const headers = new Headers();
  if (errorHeaders) {
    headers.set('Cache-Control', NO_STORE);
    return headers;
  }
  headers.set('Cache-Control', loaderHeaders.get('cache-control') ?? parentHeaders.get('cache-control') ?? NO_STORE);
  const keys = mergeSurrogateKeys(parentHeaders.get('surrogate-key'), loaderHeaders.get('surrogate-key'));
  if (keys) headers.set('Surrogate-Key', keys);
  return headers;
}
