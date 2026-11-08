/** Reloj inyectable: el dominio nunca llama a `Date.now()` (spec 3.4). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Reloj fijo para pruebas y ejemplos reproducibles. */
export function fixedClock(at: Date | string): Clock {
  const instant = new Date(at);
  return { now: () => new Date(instant) };
}
