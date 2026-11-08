// Bloques de una página publicada (PF-031). `image` y `agenda` esperan a la biblioteca de medios y a la agenda por
// publicación; mientras tanto no se pintan.
import type { PublicComponents } from '@incuba/api-client';
import { Icon } from '@incuba/ui';
import { Link } from 'react-router';
import type { EventCard } from '../events.ts';
import { isSameSite, safeHref } from '../links.ts';
import { EventCardView } from './event-card.tsx';
import { RichTextView } from './rich-text.tsx';

type Block = PublicComponents['schemas']['Block'];
type Hero = PublicComponents['schemas']['hero.v1'];
type Catalog = PublicComponents['schemas']['event_catalog.v1'];

export interface BlockData {
  catalogs: Record<string, EventCard[]>;
  featured: Record<string, EventCard | null>;
}

function Cta({ cta }: { cta: NonNullable<Hero['data']['cta']> }) {
  const href = safeHref(cta.href);
  if (!href) return null;
  const className =
    'inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-label-lg text-label-lg text-on-primary shadow-sm hover:bg-primary-container';
  const content = (
    <>
      {cta.label}
      <Icon name="arrow_forward" className="text-lg" />
    </>
  );
  if (isSameSite(href)) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} className={className} rel="noopener noreferrer">
      {content}
    </a>
  );
}

function HeroView({ block, isFirst }: { block: Hero; isFirst: boolean }) {
  const Heading = isFirst ? 'h1' : 'h2';
  return (
    <section className="rounded-xl border border-surface-container-highest bg-surface-container-lowest px-6 py-12 shadow-sm lg:px-12 lg:py-16">
      <div className="max-w-3xl space-y-4">
        <Heading className="font-display text-display-mobile text-on-surface md:text-display">
          {block.data.heading}
        </Heading>
        {block.data.subheading && <p className="font-body-lg text-body-lg text-secondary">{block.data.subheading}</p>}
        {block.data.cta && <Cta cta={block.data.cta} />}
      </div>
    </section>
  );
}

function CatalogView({ block, events }: { block: Catalog; events: EventCard[] }) {
  return (
    <section className="space-y-6">
      {block.data.heading && (
        <h2 className="font-headline-md text-headline-md text-on-surface">{block.data.heading}</h2>
      )}
      {events.length === 0 ? (
        <p className="font-body-md text-body-md text-secondary">No hay eventos próximos.</p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.slug}>
              <EventCardView event={event} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BlockView({ block, data, isFirst }: { block: Block; data: BlockData; isFirst: boolean }) {
  switch (block.type) {
    case 'hero':
      return <HeroView block={block} isFirst={isFirst} />;
    case 'rich_text':
      return <RichTextView block={block} />;
    case 'event_catalog':
      return <CatalogView block={block} events={data.catalogs[block.id] ?? []} />;
    case 'featured_event': {
      const event = data.featured[block.id];
      return event ? <EventCardView event={event} featured /> : null;
    }
    default:
      return null;
  }
}

export function Blocks({ blocks, data }: { blocks: readonly Block[]; data: BlockData }) {
  return (
    <div className="space-y-12">
      {blocks.map((block, index) => (
        <BlockView key={block.id} block={block} data={data} isFirst={index === 0} />
      ))}
    </div>
  );
}
