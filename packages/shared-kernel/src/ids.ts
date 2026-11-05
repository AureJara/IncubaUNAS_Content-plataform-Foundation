import { v7 as uuidv7 } from 'uuid';

export type Uuid = string;

/** Puerto para generar identificadores; permite fijarlos en pruebas. */
export interface IdGenerator {
  next(): Uuid;
}

export const uuidV7Generator: IdGenerator = { next: () => uuidv7() };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is Uuid =>
  typeof value === 'string' && UUID_PATTERN.test(value);
