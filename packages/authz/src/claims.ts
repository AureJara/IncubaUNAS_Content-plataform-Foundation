/** Audiencias de los tokens internos (spec 9.9). Cada servicio acepta solo la suya. */
export const AUDIENCES = ['platform-api', 'content-api'] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Claims del token interno que emite el gateway (spec 9.9). */
export interface InternalClaims {
  iss: string;
  sub: string;
  sid: string;
  /** Falta cuando la sesión todavía no eligió organización (por ejemplo, `GET /me/organizations`). */
  organization_id?: string;
  membership_id?: string;
  roles: string[];
  scopes: string[];
  aud: Audience;
  amr: string[];
  auth_time: number;
  iat: number;
  exp: number;
  jti: string;
}

export class ClaimsError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'ClaimsError';
  }
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isOptionalString = (value: unknown): boolean => value === undefined || isString(value);

/** Cada regla: los claims que revisa, cómo y qué error da. */
const RULES: readonly [readonly string[], (value: unknown) => boolean, (name: string) => string][] = [
  [['iss', 'sub', 'sid', 'jti'], isString, (name) => `falta el claim ${name}`],
  [['roles', 'scopes', 'amr'], isStringArray, (name) => `el claim ${name} debe ser una lista de textos`],
  [['auth_time', 'iat', 'exp'], isSeconds, (name) => `el claim ${name} debe ser un instante en segundos`],
  [['organization_id', 'membership_id'], isOptionalString, (name) => `el claim ${name} es inválido`],
];

/** Comprueba la forma de los claims después de verificar la firma; nada se asume por defecto. */
export function parseClaims(payload: Record<string, unknown>, audience: Audience): InternalClaims {
  for (const [names, valid, message] of RULES) {
    const wrong = names.find((name) => !valid(payload[name]));
    if (wrong !== undefined) throw new ClaimsError(message(wrong));
  }
  // `aud` exacto: un texto, no una lista que además incluya la audiencia.
  if (payload['aud'] !== audience) throw new ClaimsError('audiencia inválida');
  if (payload['organization_id'] === undefined && payload['membership_id'] !== undefined) {
    throw new ClaimsError('membership_id sin organization_id');
  }
  return payload as unknown as InternalClaims;
}
