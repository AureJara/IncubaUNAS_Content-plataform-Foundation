import type { PublicEvent, PublicEventSummary } from './api.js';

type Registration = PublicEventSummary['registration'];

export const REGISTRATION_TEXT: Record<string, string> = {
  not_open: 'Las inscripciones aún no abren.',
  open: 'Inscripciones abiertas.',
  waitlist_only: 'Cupos agotados: puedes unirte a la lista de espera.',
  closed: 'Las inscripciones están cerradas.',
};

const REGISTRATION_BADGE: Record<string, string> = {
  not_open: 'Próximamente',
  open: 'Inscripciones abiertas',
  waitlist_only: 'Lista de espera',
  closed: 'Inscripciones cerradas',
};

export const BAND_TEXT: Record<string, string> = {
  plenty: 'Hay cupos disponibles',
  few: 'Quedan pocos cupos',
  none: 'Sin cupos',
};

/** Etiqueta corta del estado de inscripción, para la insignia de la tarjeta. */
export function registrationBadge(registration: Registration | undefined): string | null {
  return registration ? (REGISTRATION_BADGE[registration.state] ?? null) : null;
}

/** Texto completo del estado de inscripción, incluida la banda de cupos cuando la hay. */
export function registrationSentence(registration: Registration | undefined): string | null {
  if (!registration) return null;
  const base = REGISTRATION_TEXT[registration.state];
  if (!base) return null;
  const band = registration.remaining_band ? BAND_TEXT[registration.remaining_band] : undefined;
  return band ? `${base} ${band}.` : base;
}

/** `kind` es una cadena libre del catálogo (`demo_day`, `workshop`…): se muestra legible. */
export function kindLabel(kind: string): string {
  const spaced = kind.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Icono (Material Symbols) por tipo de evento; `event` si no se reconoce. */
export function kindIcon(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes('workshop') || k.includes('taller')) return 'build';
  if (k.includes('bootcamp')) return 'school';
  if (k.includes('demo')) return 'rocket_launch';
  if (k.includes('hack') || k.includes('ideat')) return 'lightbulb';
  if (k.includes('congress') || k.includes('congreso') || k.includes('conference')) return 'groups';
  return 'event';
}

export type EventLike = Pick<PublicEventSummary | PublicEvent, 'status'>;

/** Un evento cancelado no admite inscripción ni se destaca como activo. */
export const isCancelled = (event: EventLike): boolean => event.status === 'cancelled';
