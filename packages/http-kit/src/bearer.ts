import type { FastifyRequest } from 'fastify';
import { Authorization, isServiceSubject, type TokenVerifier } from '@incubaunas/tenancy';
import type { Authenticated, Authenticator } from './auth.js';

/** Token de máquina o de gateway: audiencia, scopes y organización van firmados en el JWT. */
export class BearerTokenAuthenticator implements Authenticator {
  constructor(
    private readonly verifier: TokenVerifier,
    private readonly audience: string,
  ) {}

  async authenticate(request: FastifyRequest): Promise<Authenticated | null> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;

    const claims = await this.verifier.verify(header.slice('Bearer '.length), this.audience);
    const issuedAt = new Date((claims.auth_time ?? claims.iat) * 1000);
    return {
      context: {
        requestId: request.id,
        // El tenant viene del claim firmado, nunca de un header ni del cuerpo.
        organizationId: claims.organization_id ?? null,
        ...(claims.user_id ? { userId: claims.user_id } : {}),
        actor: { type: isServiceSubject(claims.sub) ? 'service' : 'user', id: claims.sub },
        authz: new Authorization({
          roles: claims.roles,
          scopes: claims.scopes,
          authTime: issuedAt,
          amr: claims.amr,
        }),
      },
    };
  }
}
