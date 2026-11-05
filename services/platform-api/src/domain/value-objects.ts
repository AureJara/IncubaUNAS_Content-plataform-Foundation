import { validationFailed } from '@incubaunas/shared-kernel';

const SLUG = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Slugs que se reservan para rutas del producto y no pueden usarlos las organizaciones. */
const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'auth',
  'platform',
  'cms',
  'public',
  'static',
  'app',
]);

export function assertSlug(value: string, pointer = '/slug'): string {
  if (!SLUG.test(value) || RESERVED_SLUGS.has(value)) {
    throw validationFailed('El slug no es válido o está reservado.', [
      {
        pointer,
        code: 'pattern',
        message: 'Usa minúsculas, números y guiones; no puede ser una palabra reservada.',
      },
    ]);
  }
  return value;
}

export function assertTimezone(value: string, pointer = '/timezone'): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    throw validationFailed('La zona horaria no es válida.', [
      { pointer, code: 'invalid', message: 'Usa un identificador IANA, p. ej. America/Lima.' },
    ]);
  }
}

export function assertLocale(value: string, pointer = '/locale'): string {
  if (!LOCALE.test(value)) {
    throw validationFailed('El idioma no es válido.', [
      { pointer, code: 'pattern', message: 'Usa un código como es-PE.' },
    ]);
  }
  return value;
}

export function assertDisplayName(value: string, pointer = '/display_name'): string {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    throw validationFailed('El nombre debe tener entre 2 y 200 caracteres.', [
      { pointer, code: 'length', message: 'Longitud no permitida.' },
    ]);
  }
  return trimmed;
}

/** Los correos se comparan sin distinguir mayúsculas ni espacios laterales. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export function assertEmail(value: string, pointer = '/email'): string {
  const normalized = normalizeEmail(value);
  if (!EMAIL.test(normalized) || normalized.length > 320) {
    throw validationFailed('El correo no es válido.', [
      { pointer, code: 'format', message: 'Formato de correo inválido.' },
    ]);
  }
  return normalized;
}
