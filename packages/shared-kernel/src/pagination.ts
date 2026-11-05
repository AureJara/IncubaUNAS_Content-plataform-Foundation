import { AppError } from './errors.js';

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const clampLimit = (limit: number | undefined): number =>
  Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);

/** Cursor opaco por keyset: el cliente no puede interpretarlo ni fabricar posiciones válidas útiles. */
export const encodeCursor = (position: Record<string, string | number>): string =>
  Buffer.from(JSON.stringify(position)).toString('base64url');

export function decodeCursor<T extends Record<string, string | number>>(
  cursor: string | undefined,
): T | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T;
  } catch {
    /* cae al error de abajo */
  }
  throw new AppError('validation_failed', 400, 'El cursor no es válido.', [
    {
      pointer: '#/query/cursor',
      code: 'invalid',
      message: 'Usa el valor de next_cursor sin modificarlo.',
    },
  ]);
}

/** Pide `limit + 1` filas para saber si hay otra página sin hacer un count. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, next_cursor: hasMore && last ? cursorOf(last) : null };
}
