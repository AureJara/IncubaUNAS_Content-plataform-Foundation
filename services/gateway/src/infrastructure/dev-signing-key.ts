import type { SigningKey } from '@incuba/authz';
import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';

/** Clave pública tal como la publica el JWKS (contrato `Jwk`). */
export interface PublicJwk {
  kty: 'EC';
  crv: 'P-256';
  kid: string;
  use: 'sig';
  alg: 'ES256';
  x: string;
  y: string;
}

export interface SigningMaterial {
  privateKey: SigningKey;
  kid: string;
  publicJwk: PublicJwk;
}

/**
 * Clave ES256 de desarrollo, generada al arrancar y solo en memoria (MOCK-05): nunca se escribe a disco ni al
 * repositorio. En staging y producción la clave vendrá del gestor de secretos (F0-13).
 */
export async function generateDevSigningKey(): Promise<SigningMaterial> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  if (jwk.x === undefined || jwk.y === undefined) throw new Error('La clave pública no tiene coordenadas');
  const kid = await calculateJwkThumbprint(jwk);
  return { privateKey, kid, publicJwk: { kty: 'EC', crv: 'P-256', kid, use: 'sig', alg: 'ES256', x: jwk.x, y: jwk.y } };
}
