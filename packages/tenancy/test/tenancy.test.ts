import { readFileSync } from 'node:fs';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { AppError, FixedClock } from '@incubaunas/shared-kernel';
import {
  Authorization,
  JoseTokenVerifier,
  ROLES,
  ROLE_SCOPES,
  SCOPES,
  isDelegableScope,
  type Restriction,
} from '../src/index.js';

const common = parse(
  readFileSync(new URL('../../../contracts/openapi/common.v1.yaml', import.meta.url), 'utf8'),
);

describe('contrato de roles y scopes', () => {
  it('coincide con los enums Role y Scope de common.v1.yaml', () => {
    expect([...ROLES].sort()).toEqual([...common.components.schemas.Role.enum].sort());
    expect([...SCOPES].sort()).toEqual([...common.components.schemas.Scope.enum].sort());
  });

  it('ningún rol concede scopes de plataforma ni del participante', () => {
    for (const role of ROLES) {
      expect(ROLE_SCOPES[role]).not.toContain('platform:admin');
      expect(ROLE_SCOPES[role]).not.toContain('registration:self');
    }
  });

  it('el security_admin no edita contenido por defecto', () => {
    const authz = new Authorization({ roles: ['security_admin'], authTime: new Date() });
    expect(authz.has('organizations:admin')).toBe(true);
    expect(authz.has('sites:write')).toBe(false);
  });

  it('platform:admin no es delegable a cuentas de servicio', () => {
    expect(isDelegableScope('platform:admin')).toBe(false);
    expect(isDelegableScope('sites:write')).toBe(true);
  });
});

describe('Authorization', () => {
  const now = new Date('2026-11-04T12:00:00Z');

  it('deniega por defecto y une los scopes de varios roles', () => {
    expect(new Authorization({ authTime: now }).scopes).toEqual([]);
    const authz = new Authorization({ roles: ['site_editor', 'report_viewer'], authTime: now });
    expect(authz.scopes).toEqual(['reports:read', 'sites:publish', 'sites:write']);
  });

  it('una restricción limita los scopes ligados a recursos al evento asignado', () => {
    const restrictions: Restriction[] = [{ type: 'event', id: 'ev-1' }];
    const authz = new Authorization({ roles: ['checkin_staff'], restrictions, authTime: now });
    expect(authz.allows('onsite:checkin', { type: 'event', id: 'ev-1' })).toBe(true);
    expect(authz.allows('onsite:checkin', { type: 'event', id: 'ev-2' })).toBe(false);
    expect(authz.allowedResourceIds('onsite:checkin', 'event')).toEqual(['ev-1']);
  });

  it('una restricción vencida deja de limitar', () => {
    const clock = new FixedClock(now);
    const restrictions: Restriction[] = [
      { type: 'event', id: 'ev-1', validUntil: new Date('2026-11-04T11:00:00Z') },
    ];
    const authz = new Authorization({
      roles: ['checkin_staff'],
      restrictions,
      authTime: now,
      clock,
    });
    expect(authz.allows('onsite:checkin', { type: 'event', id: 'ev-9' })).toBe(true);
  });

  it('exige MFA y autenticación reciente para acciones privilegiadas', () => {
    const clock = new FixedClock(now);
    const withoutMfa = new Authorization({
      roles: ['org_owner'],
      authTime: now,
      amr: ['pwd'],
      clock,
    });
    expect(() => withoutMfa.requireRecentAuthentication()).toThrowError(
      expect.objectContaining({ code: 'mfa_required' }),
    );

    const fresh = new Authorization({
      roles: ['org_owner'],
      authTime: now,
      amr: ['pwd', 'mfa'],
      clock,
    });
    expect(() => fresh.requireRecentAuthentication()).not.toThrow();

    clock.advanceSeconds(11 * 60);
    expect(() => fresh.requireRecentAuthentication()).toThrowError(
      expect.objectContaining({ code: 'recent_authentication_required' }),
    );
  });

  it('require lanza 403 sin revelar nada más', () => {
    const authz = new Authorization({ roles: ['report_viewer'], authTime: now });
    expect(() => authz.require('sites:write')).toThrowError(AppError);
  });
});

describe('JoseTokenVerifier', () => {
  const secret = new TextEncoder().encode('secret-de-prueba-de-al-menos-32-bytes!!');
  const clock = new FixedClock(new Date('2026-11-04T12:00:00Z'));
  const verifier = new JoseTokenVerifier({
    key: secret,
    issuer: 'https://platform.test',
    algorithms: ['HS256'],
    clock,
  });
  const iat = Math.floor(clock.now().getTime() / 1000);

  const sign = (claims: Record<string, unknown>, overrides: { aud?: string; iss?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(overrides.iss ?? 'https://platform.test')
      .setAudience(overrides.aud ?? 'platform-api')
      .setIssuedAt(iat)
      .setExpirationTime(iat + 300)
      .sign(secret);

  it('acepta un token con audiencia, emisor y claims válidos', async () => {
    const token = await sign({
      sub: 'service:content',
      organization_id: '0192f3a0-0000-7000-8000-0000000000a1',
      scopes: ['sites:write'],
    });
    const claims = await verifier.verify(token, 'platform-api');
    expect(claims).toMatchObject({ sub: 'service:content', scopes: ['sites:write'] });
  });

  it.each([
    ['audiencia equivocada', { aud: 'otra-api' }, { sub: 'x' }],
    ['emisor equivocado', { iss: 'https://otro.test' }, { sub: 'x' }],
    ['scope inexistente', {}, { sub: 'x', scopes: ['root:all'] }],
    ['organization_id que no es UUID', {}, { sub: 'x', organization_id: 'abc' }],
  ])('rechaza %s', async (_name, overrides, claims) => {
    const token = await sign(claims, overrides);
    await expect(verifier.verify(token, 'platform-api')).rejects.toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
  });

  it('rechaza un token vencido', async () => {
    const token = await sign({ sub: 'x' });
    clock.advanceSeconds(3600);
    await expect(verifier.verify(token, 'platform-api')).rejects.toMatchObject({ status: 401 });
  });
});
