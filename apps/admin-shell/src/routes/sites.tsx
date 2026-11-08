// Sitios web de la organización (CMS del Equipo 1). La capability `sites:write` se exige en el middleware de la ruta,
// antes de llamar a la API (FE-06).
import type { CmsComponents } from '@incuba/api-client';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { apiContext, routeError } from '../api.ts';
import { Card, PageHeader } from '../shell/page.tsx';

type SiteSummary = CmsComponents['schemas']['SiteSummary'];

export async function sitesLoader({ request, context }: LoaderFunctionArgs) {
  const { cms } = context.get(apiContext);
  const { data, error, response } = await cms.GET('/cms/v1/sites', { signal: request.signal });
  if (!data) routeError(response, error);
  return data;
}

const STATE_LABELS: Record<SiteSummary['state'], { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-surface-container text-on-surface-variant' },
  live: { label: 'Publicado', className: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  archived: { label: 'Archivado', className: 'bg-error-container text-on-error-container' },
};

const KIND_LABELS: Record<SiteSummary['kind'], string> = {
  product: 'Sitio principal',
  demo: 'Demostración',
  client: 'Cliente',
};

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' });

export function Sites() {
  const { items } = useLoaderData<typeof sitesLoader>();
  return (
    <>
      <PageHeader title="Sitios web" description="Sitios públicos de la organización y su estado de publicación." />
      <Card>
        {items.length === 0 ? (
          <p className="font-body-md text-body-md text-secondary">Todavía no hay sitios.</p>
        ) : (
          <ul className="divide-y divide-surface-container-highest" aria-label="Sitios">
            {items.map((site) => (
              <SiteRow key={site.id} site={site} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function SiteRow({ site }: { site: SiteSummary }) {
  const state = STATE_LABELS[site.state];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-label-lg text-label-lg text-on-surface">{site.name}</p>
        <p className="font-body-sm text-body-sm text-secondary">
          {KIND_LABELS[site.kind]} · {site.slug} · {site.locale}
        </p>
      </div>
      <p className="font-body-sm text-body-sm text-secondary">
        Actualizado el <time dateTime={site.updated_at}>{dateFormat.format(new Date(site.updated_at))}</time>
      </p>
      <span className={`rounded-full px-2.5 py-0.5 font-label-md text-label-md ${state.className}`}>{state.label}</span>
    </li>
  );
}
