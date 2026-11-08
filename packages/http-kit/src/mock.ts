import type { HeaderSpec, OperationSpec, ResponseSpec } from './contract.ts';

/** Respuesta que arma el mock de contrato a partir de los ejemplos (MOCK-01). */
export interface MockResponse {
  status: number;
  contentType: string | undefined;
  body: unknown;
  headers: Record<string, string>;
  /** Nombre del ejemplo usado, para `Preference-Applied`. */
  example: string | undefined;
}

/** Headers que el mock nunca copia de un ejemplo: una cookie de ejemplo no debe llegar al navegador. */
const NEVER_MOCKED = new Set(['set-cookie']);

/** Lee el nombre de `Prefer: example=<nombre>` (RFC 7240), si viene. */
export function preferredExample(prefer: string | string[] | undefined): string | undefined {
  const values = Array.isArray(prefer) ? prefer : prefer ? [prefer] : [];
  for (const value of values) {
    for (const token of value.split(/[,;]/)) {
      const [name, raw] = token.split('=').map((part) => part.trim());
      if (name?.toLowerCase() === 'example' && raw) return raw.replace(/^"(.*)"$/, '$1');
    }
  }
  return undefined;
}

function declaredExample(spec: HeaderSpec): unknown {
  const schema = typeof spec.schema === 'object' ? spec.schema : {};
  return spec.example ?? schema['const'] ?? schema['example'] ?? schema['default'];
}

/** El ETag del mock sale de la revisión del ejemplo, igual que en el caso real. */
function etagFromBody(body: unknown): string | undefined {
  const revision =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['revision'] : undefined;
  return typeof revision === 'number' ? `"r${revision}"` : undefined;
}

function headerExample(response: ResponseSpec, body: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, spec] of Object.entries(response.headers)) {
    const lower = name.toLowerCase();
    if (NEVER_MOCKED.has(lower)) continue;
    const declared = declaredExample(spec);
    const value = declared === undefined ? (lower === 'etag' ? etagFromBody(body) : undefined) : String(declared);
    if (value !== undefined) headers[name] = value;
  }
  return headers;
}

function fromResponse(response: ResponseSpec, exampleName?: string): MockResponse | undefined {
  const entries = Object.entries(response.content);
  if (entries.length === 0) {
    if (exampleName !== undefined) return undefined;
    return {
      status: response.status,
      contentType: undefined,
      body: undefined,
      headers: headerExample(response, undefined),
      example: undefined,
    };
  }
  for (const [contentType, media] of entries) {
    const names = Object.keys(media.examples);
    const name = exampleName === undefined ? names[0] : names.find((n) => n === exampleName);
    if (name === undefined) continue;
    const body = media.examples[name]?.value;
    return { status: response.status, contentType, body, headers: headerExample(response, body), example: name };
  }
  return undefined;
}

/**
 * Elige la respuesta del mock: el ejemplo pedido con `Prefer: example=<nombre>`, o el primer ejemplo de la respuesta
 * 2XX (o 3XX) de menor estado. Si el contrato no tiene ejemplo para esa respuesta, devuelve `undefined`.
 */
export function mockResponse(operation: OperationSpec, exampleName?: string): MockResponse | undefined {
  if (exampleName !== undefined) {
    for (const response of operation.responses) {
      const found = fromResponse(response, exampleName);
      if (found) return found;
    }
  }
  const success = operation.responses.find((r) => r.status >= 200 && r.status < 400);
  if (!success) return undefined;
  const mocked = fromResponse(success);
  return mocked ? { ...mocked } : undefined;
}
