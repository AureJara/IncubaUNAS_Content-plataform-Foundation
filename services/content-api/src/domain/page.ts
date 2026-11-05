import { contentHash, type Uuid } from '@incubaunas/shared-kernel';
import type { Block } from './blocks.js';

export interface Seo {
  title?: string;
  description?: string;
  canonical_url?: string;
  og_image_media_id?: string;
  robots?: 'index' | 'noindex';
}

export interface PageSnapshot {
  id: Uuid;
  organizationId: Uuid;
  siteId: Uuid;
  path: string;
  title: string;
  locale: string;
  blocks: Block[];
  seo: Seo;
  publishedVersion: number | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Lo que se congela al publicar: contenido, nunca metadatos de edición. */
export interface PublishedContent {
  path: string;
  title: string;
  locale: string;
  blocks: Block[];
  seo: Seo;
}

export interface PublicationRecord {
  id: Uuid;
  organizationId: Uuid;
  pageId: Uuid;
  version: number;
  snapshot: PublishedContent;
  contentHash: string;
  restoredFromVersion: number | null;
  publishedAt: Date;
}

export const snapshotOf = (
  page: Pick<PageSnapshot, 'path' | 'title' | 'locale' | 'blocks' | 'seo'>,
): PublishedContent => ({
  path: page.path,
  title: page.title,
  locale: page.locale,
  blocks: page.blocks,
  seo: page.seo,
});

/** Hash canónico del snapshot: dos publicaciones con el mismo contenido tienen el mismo hash. */
export const hashOf = (content: PublishedContent): string => contentHash(content);

export function newPublication(
  input: { id: Uuid; page: PageSnapshot; content: PublishedContent; restoredFromVersion?: number },
  now: Date,
): PublicationRecord {
  return {
    id: input.id,
    organizationId: input.page.organizationId,
    pageId: input.page.id,
    version: (input.page.publishedVersion ?? 0) + 1,
    snapshot: input.content,
    contentHash: hashOf(input.content),
    restoredFromVersion: input.restoredFromVersion ?? null,
    publishedAt: now,
  };
}
