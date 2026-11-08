import type { Clock } from './clock.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type RandomSource = (bytes: Uint8Array) => Uint8Array;

const cryptoRandom: RandomSource = (bytes) => globalThis.crypto.getRandomValues(bytes);

/**
 * Generador de UUIDv7 (RFC 9562): 48 bits de milisegundos, versión 7, variante 10 y 74 bits aleatorios.
 * Recibe el reloj para que el dominio siga sin depender de `Date.now()`.
 */
export function createUuidV7(clock: Clock, random: RandomSource = cryptoRandom): () => string {
  return () => {
    const bytes = random(new Uint8Array(16));
    let ms = clock.now().getTime();
    for (let i = 5; i >= 0; i--) {
      bytes[i] = ms % 256;
      ms = Math.floor(ms / 256);
    }
    bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
    bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}
