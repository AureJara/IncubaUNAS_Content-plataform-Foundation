import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Markdown → HTML seguro. La API ya rechaza HTML crudo al guardar; esto es defensa en profundidad:
 * lo que sale al navegador pasa por una lista permitida de etiquetas y atributos.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'h2',
    'h3',
    'h4',
    'a',
    'hr',
  ],
  // `rel` debe estar permitido: el transform lo añade, y sin esto el sanitizador lo volvería a quitar.
  allowedAttributes: { a: ['href', 'title', 'rel'] },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export function renderMarkdown(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown, { async: false, gfm: true }), OPTIONS);
}
