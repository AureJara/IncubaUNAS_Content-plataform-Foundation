// Enlaces del contenido publicado (RN-18): solo rutas del mismo sitio o `https:`. El contrato ya lo valida; aquí se
// vuelve a comprobar antes de pintar, porque un `href` es un vector de XSS y de redirección abierta.
const SAME_SITE = /^\/(?![/\\])\S*$/u;

export function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (SAME_SITE.test(href)) return href;
  if (/\s/u.test(href)) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.username === '' && url.password === '' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function isSameSite(href: string): boolean {
  return SAME_SITE.test(href);
}
