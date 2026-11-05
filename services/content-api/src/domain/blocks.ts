import {
  Ajv2020,
  addFormats,
  validationFailed,
  type FieldError,
  type ValidateFunction,
} from '@incubaunas/shared-kernel';

export const BLOCK_TYPES = [
  'hero',
  'rich_text',
  'image',
  'event_catalog',
  'featured_event',
  'agenda',
  'cta',
  'faq',
  'lead_form',
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export interface Block {
  type: BlockType;
  props: Record<string, unknown>;
}

/** Enlaces permitidos: ruta relativa (sin `//`) o HTTPS. Nunca `javascript:`, `data:` ni protocolo relativo. */
const href = { type: 'string', pattern: '^(/(?!/)|https://)', maxLength: 2048 };
const uuid = { type: 'string', format: 'uuid' };
const slug = { type: 'string', pattern: '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' };
const text = (max: number, min = 1) => ({ type: 'string', minLength: min, maxLength: max });

/** Un JSON Schema por tipo de bloque: la API no acepta nada que el sitio público no sepa pintar. */
const SCHEMAS: Record<BlockType, object> = {
  hero: {
    type: 'object',
    required: ['heading'],
    additionalProperties: false,
    properties: {
      heading: text(120),
      subheading: text(240),
      image_media_id: uuid,
      cta_label: text(40),
      cta_href: href,
    },
  },
  rich_text: {
    type: 'object',
    required: ['markdown'],
    additionalProperties: false,
    properties: { markdown: text(20_000) },
  },
  image: {
    type: 'object',
    required: ['media_id', 'alt'],
    additionalProperties: false,
    // El texto alternativo es obligatorio en imágenes públicas (accesibilidad).
    properties: { media_id: uuid, alt: text(300), caption: text(300) },
  },
  event_catalog: {
    type: 'object',
    additionalProperties: false,
    properties: { kind: text(40), limit: { type: 'integer', minimum: 1, maximum: 50 } },
  },
  featured_event: {
    type: 'object',
    required: ['event_slug'],
    additionalProperties: false,
    properties: { event_slug: slug },
  },
  agenda: {
    type: 'object',
    required: ['event_slug'],
    additionalProperties: false,
    properties: { event_slug: slug },
  },
  cta: {
    type: 'object',
    required: ['label', 'href'],
    additionalProperties: false,
    properties: { label: text(60), href },
  },
  faq: {
    type: 'object',
    required: ['items'],
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: {
          type: 'object',
          required: ['question', 'answer'],
          additionalProperties: false,
          properties: { question: text(200), answer: text(2_000) },
        },
      },
    },
  },
  lead_form: {
    type: 'object',
    required: ['title'],
    additionalProperties: false,
    properties: { title: text(120), description: text(500) },
  },
};

/** Etiqueta HTML cruda: el contenido es Markdown y el HTML se rechaza en el origen. */
const RAW_HTML = /<\/?[a-z!][^>]*>/i;

/** Campos de texto largo que se revisan en busca de HTML o esquemas peligrosos. */
const TEXT_FIELDS: Partial<
  Record<BlockType, (props: Record<string, unknown>) => { pointer: string; value: string }[]>
> = {
  rich_text: (p) => [{ pointer: '/markdown', value: String(p.markdown ?? '') }],
  faq: (p) =>
    ((p.items as { answer?: unknown }[] | undefined) ?? []).map((item, index) => ({
      pointer: `/items/${index}/answer`,
      value: String(item.answer ?? ''),
    })),
};

export class BlockValidator {
  private readonly ajv = new Ajv2020({ strict: false, allErrors: true });
  private readonly validators = new Map<BlockType, ValidateFunction>();

  constructor() {
    addFormats(this.ajv);
    for (const type of BLOCK_TYPES) this.validators.set(type, this.ajv.compile(SCHEMAS[type]));
  }

  /** Devuelve los bloques normalizados o lanza 422 con un `pointer` por cada defecto. */
  validate(
    blocks: readonly { type: string; props: Record<string, unknown> }[],
    base = '/blocks',
  ): Block[] {
    const errors: FieldError[] = [];
    blocks.forEach((block, index) => {
      const at = `${base}/${index}`;
      const validate = this.validators.get(block.type as BlockType);
      if (!validate) {
        errors.push({
          pointer: `${at}/type`,
          code: 'enum',
          message: `Tipo de bloque desconocido: ${block.type}`,
        });
        return;
      }
      if (!validate(block.props)) {
        for (const issue of validate.errors ?? []) {
          const extra = issue.params?.missingProperty ?? issue.params?.additionalProperty;
          errors.push({
            pointer: `${at}/props${issue.instancePath}${extra ? `/${extra}` : ''}`,
            code: issue.keyword,
            message: issue.message ?? 'Valor no válido.',
          });
        }
        return;
      }
      for (const field of TEXT_FIELDS[block.type as BlockType]?.(block.props) ?? []) {
        if (RAW_HTML.test(field.value)) {
          errors.push({
            pointer: `${at}/props${field.pointer}`,
            code: 'html_not_allowed',
            message: 'Usa Markdown: el HTML no está permitido.',
          });
        }
      }
    });
    if (errors.length > 0) throw validationFailed('Hay bloques que no cumplen su esquema.', errors);
    return blocks.map((b) => ({ type: b.type as BlockType, props: b.props }));
  }

  /** Identificadores de medios que referencia una lista de bloques (para exigir que estén listos). */
  static mediaIds(blocks: readonly Block[]): string[] {
    const ids = blocks.flatMap((block) => {
      if (block.type === 'hero') return [block.props.image_media_id];
      if (block.type === 'image') return [block.props.media_id];
      return [];
    });
    return [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  }
}
