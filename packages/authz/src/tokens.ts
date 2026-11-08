import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey, type JWTVerifyOptions } from 'jose';
import { ClaimsError, parseClaims, type Audience, type InternalClaims } from './claims.ts';

/** Vida de un token interno (spec 9.9): cinco minutos. */
export const TOKEN_TTL_SECONDS = 300;
const CLOCK_TOLERANCE_SECONDS = 5;

export interface ClockLike {
  now(): Date;
}

export type SigningKey = Parameters<SignJWT['sign']>[0];

/** El token no sirve: firma, emisor, audiencia, vigencia o claims. El servicio responde 401. */
export class TokenError extends Error {
  constructor(detail: string, options?: ErrorOptions) {
    super(detail, options);
    this.name = 'TokenError';
  }
}

export interface TokenVerifierOptions {
  issuer: string;
  /** La audiencia de este servicio; se exige exacta. */
  audience: Audience;
  /** URL del JWKS del gateway, o un resolvedor de claves (pruebas). */
  keys: URL | JWTVerifyGetKey;
  clock?: ClockLike;
}

export type TokenVerifier = (token: string) => Promise<InternalClaims>;

/** Verifica un token interno: ES256, emisor y audiencia exactos, vigencia y claims (spec 9.9). */
export function createTokenVerifier(options: TokenVerifierOptions): TokenVerifier {
  const getKey =
    options.keys instanceof URL
      ? createRemoteJWKSet(options.keys, { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 })
      : options.keys;
  return async (token) => {
    const verifyOptions: JWTVerifyOptions = {
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ['ES256'],
      maxTokenAge: TOKEN_TTL_SECONDS + CLOCK_TOLERANCE_SECONDS,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'jti'],
    };
    if (options.clock) verifyOptions.currentDate = options.clock.now();
    try {
      const { payload } = await jwtVerify(token, getKey, verifyOptions);
      return parseClaims(payload as Record<string, unknown>, options.audience);
    } catch (error) {
      const detail = error instanceof ClaimsError ? error.message : 'token inválido o vencido';
      throw new TokenError(detail, { cause: error });
    }
  };
}

/** Datos de la sesión con los que el gateway firma un token interno. */
export interface TokenSubject {
  sub: string;
  sid: string;
  organization_id?: string;
  membership_id?: string;
  roles: readonly string[];
  scopes: readonly string[];
  amr: readonly string[];
  auth_time: number;
}

export interface TokenSignerOptions {
  issuer: string;
  privateKey: SigningKey;
  kid: string;
  clock: ClockLike;
  newId: () => string;
  ttlSeconds?: number;
}

export type TokenSigner = (subject: TokenSubject, audience: Audience) => Promise<string>;

/** Firma tokens internos (solo el gateway). */
export function createTokenSigner(options: TokenSignerOptions): TokenSigner {
  const ttl = options.ttlSeconds ?? TOKEN_TTL_SECONDS;
  return async (subject, audience) => {
    const now = Math.floor(options.clock.now().getTime() / 1000);
    return new SignJWT({ ...subject, roles: [...subject.roles], scopes: [...subject.scopes], amr: [...subject.amr] })
      .setProtectedHeader({ alg: 'ES256', kid: options.kid, typ: 'JWT' })
      .setIssuer(options.issuer)
      .setSubject(subject.sub)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .setJti(options.newId())
      .sign(options.privateKey);
  };
}
