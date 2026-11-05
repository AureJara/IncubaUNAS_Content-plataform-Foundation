import { AppError } from './errors.js';

/** ETag fuerte de una revisión: el valor es la revisión entre comillas. */
export const etagFor = (revision: number): string => `"${revision}"`;

/**
 * Convierte el header `If-Match` en la revisión esperada. Los comandos mutables lo exigen:
 * si falta o no es una revisión devuelve 428/400 según el caso.
 */
export function parseIfMatch(header: string | string[] | undefined): number {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    throw new AppError('validation_failed', 400, 'Falta el header If-Match.', [
      { pointer: '#/header/If-Match', code: 'required', message: 'Envía el ETag recibido.' },
    ]);
  }
  const match = /^(?:W\/)?"(\d+)"$/.exec(raw.trim());
  if (!match) {
    throw new AppError('validation_failed', 400, 'El header If-Match no es válido.', [
      { pointer: '#/header/If-Match', code: 'invalid', message: 'Formato esperado: "<revisión>".' },
    ]);
  }
  return Number(match[1]);
}
