import { HttpProblem } from './problem.ts';

export type CursorData = Readonly<Record<string, string | number>>;

/** Cursor opaco (spec 9.1): JSON en base64url. No es secreto; el servidor vuelve a validar lo que trae. */
export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
}

/** Decodifica un cursor; si está mal formado responde 400 `bad_request`. */
export function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // cae al error de abajo
  }
  throw new HttpProblem({
    status: 400,
    code: 'bad_request',
    detail: 'El cursor no es válido.',
    errors: [{ pointer: '/query/cursor', detail: 'cursor inválido' }],
  });
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

/**
 * Pagina una lista ya ordenada por una clave estable (para los adaptadores en memoria). El cursor guarda la clave
 * del último elemento devuelto.
 */
export function paginate<T>(items: readonly T[], keyOf: (item: T) => string, limit: number, cursor?: string): Page<T> {
  const after = cursor === undefined ? undefined : decodeCursor(cursor)['after'];
  const start = typeof after === 'string' ? items.findIndex((item) => keyOf(item) === after) + 1 : 0;
  const slice = items.slice(start, start + limit);
  const last = slice.at(-1);
  const hasMore = start + limit < items.length;
  return { items: slice, next_cursor: hasMore && last !== undefined ? encodeCursor({ after: keyOf(last) }) : null };
}
