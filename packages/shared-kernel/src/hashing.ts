import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

/** JSON canónico: claves ordenadas y sin espacios, para que el hash no dependa del orden. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

/** Hash de contenido en el formato de los contratos: `sha256:<hex>`. */
export const contentHash = (value: unknown): string => `sha256:${sha256Hex(canonicalize(value))}`;

export const hmacHex = (key: string | Uint8Array, value: string): string =>
  createHmac('sha256', key).update(value).digest('hex');

/** Token opaco aleatorio (base64url) para sesiones, invitaciones y vistas previas. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
