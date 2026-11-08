import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  checkRequirement,
  createTokenSigner,
  createTokenVerifier,
  scopesForRoles,
  TokenError,
  type TokenSigner,
  type TokenSubject,
} from '../src/index.ts';

const ISSUER = 'http://localhost:8080';
const NOW = new Date('2026-11-08T15:00:00.000Z');
const clock = { now: () => NOW };
let counter = 0;
const newId = () => `jti-${(counter += 1)}`;

const subject: TokenSubject = {
  sub: '01933f42-3c4d-7e5f-8a60-7b8c9d0e1f2a',
  sid: '01933f5e-9d3b-7a01-8c22-4b5c6d7e8f90',
  organization_id: '01933f40-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  membership_id: '01933f41-2b3c-7d4e-9f50-6b7c8d9e0f1a',
  roles: ['site_editor'],
  scopes: ['sites:write', 'sites:publish'],
  amr: ['pwd', 'mfa'],
  auth_time: Math.floor(NOW.getTime() / 1000),
};

let sign: TokenSigner;
let jwks: { keys: JWK[] };

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' }] };
  sign = createTokenSigner({ issuer: ISSUER, privateKey, kid: 'k1', clock, newId });
});

const verifier = (audience: 'platform-api' | 'content-api', at = NOW) =>
  createTokenVerifier({ issuer: ISSUER, audience, keys: createLocalJWKSet(jwks), clock: { now: () => at } });

describe('tokens internos (spec 9.9)', () => {
  it('firma y verifica con todos los claims', async () => {
    const claims = await verifier('content-api')(await sign(subject, 'content-api'));
    expect(claims).toMatchObject({ ...subject, iss: ISSUER, aud: 'content-api', jti: expect.any(String) });
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('rechaza otra audiencia', async () => {
    const token = await sign(subject, 'platform-api');
    await expect(verifier('content-api')(token)).rejects.toBeInstanceOf(TokenError);
  });

  it('rechaza un token vencido', async () => {
    const token = await sign(subject, 'content-api');
    const later = new Date(NOW.getTime() + 6 * 60_000);
    await expect(verifier('content-api', later)(token)).rejects.toBeInstanceOf(TokenError);
  });

  it('rechaza una firma de otra clave', async () => {
    const other = await generateKeyPair('ES256');
    const forged = await createTokenSigner({ issuer: ISSUER, privateKey: other.privateKey, kid: 'k1', clock, newId })(
      subject,
      'content-api',
    );
    await expect(verifier('content-api')(forged)).rejects.toBeInstanceOf(TokenError);
  });
});

describe('roles y scopes (spec 1.6)', () => {
  it('org_owner tiene todos los scopes; cada rol, los suyos', () => {
    expect(scopesForRoles(['org_owner'])).toHaveLength(11);
    expect(scopesForRoles(['site_editor', 'report_viewer'])).toEqual(['sites:write', 'sites:publish', 'reports:read']);
    expect(scopesForRoles(['desconocido'])).toEqual([]);
  });

  const now = Math.floor(NOW.getTime() / 1000);
  const grant = { roles: ['site_editor'], scopes: ['sites:write'], amr: ['pwd', 'mfa'], authTime: now };

  it('exige el scope de la operación', () => {
    expect(checkRequirement(grant, { scope: 'sites:write' }, now)).toBe('ok');
    expect(checkRequirement(grant, { scope: 'sites:publish' }, now)).toBe('forbidden');
  });

  it('un rol exigido se cumple con ese rol u org_owner, salvo platform_admin', () => {
    const owner = { ...grant, roles: ['org_owner'] };
    expect(checkRequirement(owner, { role: 'security_admin' }, now)).toBe('ok');
    expect(checkRequirement(owner, { role: 'platform_admin' }, now)).toBe('forbidden');
    expect(checkRequirement(grant, { role: 'security_admin' }, now)).toBe('forbidden');
  });

  it('MFA reciente: `mfa` en amr y menos de diez minutos', () => {
    expect(checkRequirement(grant, { recentMfa: true }, now + 600)).toBe('ok');
    expect(checkRequirement(grant, { recentMfa: true }, now + 601)).toBe('recent_auth_required');
    expect(checkRequirement({ ...grant, amr: ['pwd'] }, { recentMfa: true }, now)).toBe('recent_auth_required');
  });
});
