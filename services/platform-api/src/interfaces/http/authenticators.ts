import type { FastifyRequest } from 'fastify';
import type { Authenticated, Authenticator } from '@incubaunas/http-kit';
import { safeEqual } from '@incubaunas/shared-kernel';
import type { SessionService } from '../../application/sessions.js';

/** Sesión del BFF: cookie HttpOnly con un identificador opaco; los permisos salen de la base. */
export class SessionCookieAuthenticator implements Authenticator {
  constructor(
    private readonly sessions: SessionService,
    private readonly cookieName: string,
  ) {}

  async authenticate(request: FastifyRequest): Promise<Authenticated | null> {
    const value = request.cookies[this.cookieName];
    if (!value) return null;
    const session = await this.sessions.authenticate(value, request.id);
    if (!session) return null;
    return {
      context: session.context,
      verifyCsrf: (token) => token !== undefined && safeEqual(token, session.csrfToken),
    };
  }
}
