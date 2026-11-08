import { scopesForRoles, type Role, type TokenSubject } from '@incuba/authz';
import type { Clock } from '@incuba/shared-kernel';
import type { SessionResolver } from '../application/ports.ts';

/** Usuario ficticio del seed (contracts/examples/platform.yaml). Datos inventados: el repositorio es público. */
export const TEST_SESSION = {
  userId: '01933f42-3c4d-7e5f-8a60-7b8c9d0e1f2a',
  organizationId: '01933f40-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  membershipId: '01933f41-2b3c-7d4e-9f50-6b7c8d9e0f1a',
  sessionId: '01933f5e-9d3b-7a01-8c22-4b5c6d7e8f90',
} as const;

/**
 * Sesión de prueba (MOCK-05): mientras el login BFF no exista (Fase 1), todo request al gateway en local o CI se
 * atiende como el usuario ficticio con el rol de `MOCK_ROLE`. `auth_time` es el momento de cada request, así que
 * las operaciones con MFA reciente pasan; probar `recent_auth_required` queda para las pruebas de `authz`.
 */
export function testSessionResolver(role: Role, clock: Clock): SessionResolver {
  return async (): Promise<TokenSubject> => ({
    sub: TEST_SESSION.userId,
    sid: TEST_SESSION.sessionId,
    organization_id: TEST_SESSION.organizationId,
    membership_id: TEST_SESSION.membershipId,
    roles: [role],
    scopes: scopesForRoles([role]),
    amr: ['pwd', 'mfa'],
    auth_time: Math.floor(clock.now().getTime() / 1000),
  });
}
