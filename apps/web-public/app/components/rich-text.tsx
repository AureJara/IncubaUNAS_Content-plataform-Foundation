// Texto enriquecido estructurado (rich_text.v1). Se pinta solo con elementos de React: nunca HTML crudo.
import type { PublicComponents } from '@incuba/api-client';
import type { ReactNode } from 'react';
import { safeHref } from '../links.ts';

type RichText = PublicComponents['schemas']['rich_text.v1'];
type RichNode = RichText['data']['nodes'][number];
type Span = RichNode['spans'][number];

function SpanView({ span }: { span: Span }) {
  let content: ReactNode = span.text;
  const marks = span.marks ?? [];
  if (marks.includes('code')) content = <code>{content}</code>;
  if (marks.includes('italic')) content = <em>{content}</em>;
  if (marks.includes('bold')) content = <strong>{content}</strong>;
  const href = safeHref(span.href);
  if (!href) return <>{content}</>;
  const external = !href.startsWith('/');
  return (
    <a href={href} className="text-primary underline" {...(external ? { rel: 'noopener noreferrer' } : {})}>
      {content}
    </a>
  );
}

function Spans({ spans }: { spans: readonly Span[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <SpanView key={index} span={span} />
      ))}
    </>
  );
}

const HEADING_CLASS = {
  2: 'font-headline-md text-headline-md text-on-surface',
  3: 'font-headline-sm text-headline-sm text-on-surface',
  4: 'font-title text-title text-on-surface',
} as const;

function Heading({ node }: { node: RichNode }) {
  const level = node.level === 3 || node.level === 4 ? node.level : 2;
  const Tag = `h${level}` as const;
  return (
    <Tag className={HEADING_CLASS[level]}>
      <Spans spans={node.spans} />
    </Tag>
  );
}

type Group = { kind: 'list'; items: RichNode[] } | { kind: 'node'; node: RichNode };

/** Agrupa los `list_item` seguidos en una sola lista. */
function group(nodes: readonly RichNode[]): Group[] {
  const groups: Group[] = [];
  for (const node of nodes) {
    const last = groups.at(-1);
    if (node.kind !== 'list_item') groups.push({ kind: 'node', node });
    else if (last?.kind === 'list') last.items.push(node);
    else groups.push({ kind: 'list', items: [node] });
  }
  return groups;
}

export function RichTextView({ block }: { block: RichText }) {
  return (
    <section className="max-w-3xl space-y-4 font-body-lg text-body-lg text-on-surface">
      {group(block.data.nodes).map((entry, index) => {
        if (entry.kind === 'list') {
          return (
            <ul key={index} className="list-disc space-y-1 pl-6">
              {entry.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Spans spans={item.spans} />
                </li>
              ))}
            </ul>
          );
        }
        if (entry.node.kind === 'heading') return <Heading key={index} node={entry.node} />;
        return (
          <p key={index}>
            <Spans spans={entry.node.spans} />
          </p>
        );
      })}
    </section>
  );
}
