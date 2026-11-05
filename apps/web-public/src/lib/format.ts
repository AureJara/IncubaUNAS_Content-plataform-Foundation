/** Fechas en la zona horaria del evento (no la del servidor ni la del visitante). */
export function formatRange(
  startsAt: string,
  endsAt: string,
  timezone: string,
  locale: string,
): string {
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: timezone });
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: timezone });
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return day.format(start) === day.format(end)
    ? `${day.format(start)}, ${time.format(start)} – ${time.format(end)}`
    : `${day.format(start)} – ${day.format(end)}`;
}

export const formatTime = (iso: string, timezone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: timezone }).format(new Date(iso));

/** Un `href` de bloque solo se renderiza si es ruta relativa o HTTPS. */
export const safeHref = (href: unknown): string =>
  typeof href === 'string' && /^(\/(?!\/)|https:\/\/)/.test(href) ? href : '#';

/** Título de pestaña de una página dinámica: «Página · Nombre del sitio» (sin repetir el nombre). */
export const pageTitle = (title: string, siteName: string): string =>
  title === siteName ? siteName : `${title} · ${siteName}`;

/** Fecha corta para insignias («24 oct»), en la zona horaria del evento. */
export function formatShortDate(iso: string, timezone: string, locale: string): string {
  // Se arma con las partes: cada idioma separa día y mes a su manera ("30 nov", "30-nov", "Nov 30").
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    timeZone: timezone,
  }).formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = (parts.find((part) => part.type === 'month')?.value ?? '').replace('.', '');
  return `${day} ${month}`.trim().toUpperCase();
}
