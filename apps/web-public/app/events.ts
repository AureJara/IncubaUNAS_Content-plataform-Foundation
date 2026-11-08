// Eventos listos para pintar. Las fechas se formatean en el loader, en la zona horaria del evento, para que el HTML
// del servidor y la hidratación coincidan sin depender del reloj ni del ICU del navegador.
import type { PublicComponents } from '@incuba/api-client';

type EventFields = PublicComponents['schemas']['PublicEventFields'];
type Modality = PublicComponents['schemas']['Modality'];
type RegistrationStatus = PublicComponents['schemas']['Registration']['status'];

export interface EventCard {
  slug: string;
  title: string;
  summary: string;
  cancelled: boolean;
  modality: string;
  when: string;
  venue: string | null;
  registration: string;
}

const MODALITY_LABELS: Record<Modality, string> = {
  in_person: 'Presencial',
  online: 'En línea',
  hybrid: 'Híbrido',
};

const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
  not_open: 'Inscripciones aún no abiertas',
  open: 'Inscripciones abiertas',
  few_left: 'Quedan pocos cupos',
  full: 'Cupos agotados',
  closed: 'Inscripciones cerradas',
};

const FALLBACK_LOCALE = 'es-PE';

function dateFormat(locale: string, timeZone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short', timeZone };
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    // Locale o zona inválidos en los datos: mejor una fecha en UTC que una página caída.
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, { ...options, timeZone: 'UTC' });
  }
}

export function formatRange(startsAt: string, endsAt: string, timeZone: string, locale: string): string {
  return dateFormat(locale, timeZone).formatRange(new Date(startsAt), new Date(endsAt));
}

export function toEventCard(event: EventFields, locale: string): EventCard {
  return {
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    cancelled: event.state === 'cancelled',
    modality: MODALITY_LABELS[event.modality],
    when: formatRange(event.starts_at, event.ends_at, event.timezone, locale),
    venue: event.venue_name ?? null,
    registration: REGISTRATION_LABELS[event.registration.status],
  };
}
