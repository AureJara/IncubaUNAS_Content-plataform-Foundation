// Detalle público de un evento: datos del release activo, agenda y programas (PF-044). La inscripción la monta el
// Equipo 3 como isla; aquí solo se muestra el estado orientativo (RN-15).
import { Icon } from '@incuba/ui';
import { data, Link } from 'react-router';
import { publicApi, upstreamError } from '../api.server.ts';
import { cacheHeaders, routeHeaders } from '../cache.ts';
import { formatRange, toEventCard } from '../events.ts';
import { siteContext } from '../site.server.ts';
import type { Route } from './+types/event';

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const site = context.get(siteContext);
  const { data: event, response } = await publicApi(context).GET('/public/v1/sites/{slug}/events/{event_slug}', {
    params: { path: { slug: site.slug, event_slug: params.eventSlug } },
    signal: request.signal,
  });
  if (!event) upstreamError(response);
  const detail = {
    ...toEventCard(event, site.locale),
    description: event.description,
    sessions: event.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      when: formatRange(session.starts_at, session.ends_at, event.timezone, site.locale),
      location: session.location ?? null,
    })),
    programs: event.programs.map((program) => program.name),
  };
  return data({ event: detail }, { headers: cacheHeaders([response], [site.surrogateKey]) });
}

export const headers: Route.HeadersFunction = (args) => routeHeaders(args);

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  if (!loaderData) return [{ title: 'Evento no encontrado' }];
  const siteName = matches[0].loaderData?.site.name;
  return [
    { title: siteName ? `${loaderData.event.title} · ${siteName}` : loaderData.event.title },
    { name: 'description', content: loaderData.event.summary },
  ];
};

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const { event } = loaderData;
  return (
    <article className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 font-label-lg text-label-lg text-primary hover:underline"
      >
        Volver al inicio
      </Link>
      {event.cancelled && (
        <p
          role="status"
          className="rounded-xl border border-error-container bg-error-container p-4 font-label-lg text-label-lg text-on-error-container"
        >
          Este evento fue cancelado.
        </p>
      )}
      <header className="space-y-3">
        <p className="font-label-md text-label-md text-secondary">{event.modality}</p>
        <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:text-headline-lg">{event.title}</h1>
        <p className="max-w-3xl font-body-lg text-body-lg text-secondary">{event.summary}</p>
        <ul className="space-y-1.5 font-body-md text-body-md text-on-surface-variant">
          <li className="flex items-center gap-2">
            <Icon name="calendar_month" className="shrink-0 text-lg text-primary" />
            {event.when}
          </li>
          {event.venue && (
            <li className="flex items-center gap-2">
              <Icon name="location_on" className="shrink-0 text-lg text-primary" />
              {event.venue}
            </li>
          )}
        </ul>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section className="max-w-3xl space-y-4 font-body-lg text-body-lg text-on-surface">
            {event.description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
          {event.sessions.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">Agenda</h2>
              <ol className="divide-y divide-surface-container-highest rounded-xl border border-surface-container-highest bg-surface-container-lowest">
                {event.sessions.map((session) => (
                  <li key={session.id} className="space-y-1 p-4">
                    <p className="font-label-lg text-label-lg text-on-surface">{session.title}</p>
                    <p className="font-body-sm text-body-sm text-secondary">
                      {session.when}
                      {session.location ? ` · ${session.location}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
        <aside className="h-fit space-y-4 rounded-xl border border-surface-container-highest bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Inscripción</h2>
          <p className="font-label-lg text-label-lg text-tertiary">{event.registration}</p>
          <p className="font-body-sm text-body-sm text-secondary">
            La inscripción en línea estará disponible próximamente en esta página.
          </p>
          {event.programs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-title text-title text-on-surface">Programas</h3>
              <ul className="space-y-1 font-body-sm text-body-sm text-secondary">
                {event.programs.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
