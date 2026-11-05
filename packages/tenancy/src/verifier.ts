import { jwtVerify, type JWTVerifyGetKey, type CryptoKey, type KeyObject } from 'jose';
import { systemClock, unauthenticated, type Clock } from '@incubaunas/shared-kernel';
import { claimsSchema, type AuthClaims } from './claims.js';

/** Puerto: valida un bearer token y devuelve claims ya comprobados. */
export interface TokenVerifier {
  verify(token: string, audience: string): Promise<AuthClaims>;
}

export interface JoseVerifierOptions {
  /** Clave simétrica/pública o función JWKS (`createRemoteJWKSet`). */
  key: CryptoKey | KeyObject | Uint8Array | JWTVerifyGetKey;
  issuer: string;
  algorithms: readonly string[];
  clockToleranceSeconds?: number;
  clock?: Clock;
}

export class JoseTokenVerifier implements TokenVerifier {
  private readonly clock: Clock;

  constructor(private readonly options: JoseVerifierOptions) {
    this.clock = options.clock ?? systemClock;
  }

  async verify(token: string, audience: string): Promise<AuthClaims> {
    try {
      const { payload } = await jwtVerify(token, this.options.key as CryptoKey, {
        issuer: this.options.issuer,
        audience,
        algorithms: [...this.options.algorithms],
        clockTolerance: this.options.clockToleranceSeconds ?? 5,
        currentDate: this.clock.now(),
      });
      return claimsSchema.parse(payload);
    } catch {
      // Nunca se explica por qué falló: evita que el error sirva de oráculo.
      throw unauthenticated('El token no es válido.');
    }
  }
}
