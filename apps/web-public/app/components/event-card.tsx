// Tarjeta de evento del catálogo y del destacado.
import { Icon } from '@incuba/ui';
import { Link } from 'react-router';
import type { EventCard } from '../events.ts';

export function EventCardView({ event, featured = false }: { event: EventCard; featured?: boolean }) {
  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-6 shadow-sm ${
        featured ? 'lg:p-8' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary-container px-2.5 py-0.5 font-label-md text-label-md text-on-secondary-container">
          {event.modality}
        </span>
        {event.cancelled && (
          <span className="rounded-full bg-error-container px-2.5 py-0.5 font-label-md text-label-md text-on-error-container">
            Cancelado
          </span>
        )}
      </div>
      <h3 className={featured ? 'font-headline-md text-headline-md' : 'font-headline-sm text-headline-sm'}>
        <Link to={`/eventos/${encodeURIComponent(event.slug)}`} className="text-on-surface hover:text-primary">
          {event.title}
        </Link>
      </h3>
      <p className="font-body-md text-body-md text-secondary">{event.summary}</p>
      <ul className="mt-auto space-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
        <li className="flex items-center gap-2">
          <Icon name="calendar_month" className="shrink-0 text-base text-primary" />
          {event.when}
        </li>
        {event.venue && (
          <li className="flex items-center gap-2">
            <Icon name="location_on" className="shrink-0 text-base text-primary" />
            {event.venue}
          </li>
        )}
      </ul>
      {!event.cancelled && <p className="font-label-md text-label-md text-tertiary">{event.registration}</p>}
    </article>
  );
}
