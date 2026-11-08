import { checkRequirement } from '@incuba/authz';
import { createSecurity, principalFromClaims, unauthorized, type SecurityAdapter } from '@incuba/http-kit';
import type { Clock } from '@incuba/shared-kernel';
import type { SessionResolver } from '../../application/ports.ts';

/** Seguridad de las operaciones propias del gateway (`sessionCookie`, `csrfToken` en auth.yaml). */
export function sessionSecurity(resolve: SessionResolver, clock: Clock): SecurityAdapter {
  return createSecurity({
    async authenticate(request) {
      const session = await resolve(request);
      if (session === undefined) throw unauthorized();
      return principalFromClaims(session);
    },
    decide: (principal, operation) =>
      checkRequirement(
        principal,
        { scope: operation.requiredScope, role: operation.requiredRole, recentMfa: operation.recentMfa },
        Math.floor(clock.now().getTime() / 1000),
      ),
  });
}
