import type { FastifyReply } from 'fastify';
import type { IssuedSession } from '../../application/sessions.js';

export interface CookieNames {
  session: string;
  csrf: string;
  loginAttempt: string;
}

export interface CookieSettings {
  names: CookieNames;
  secure: boolean;
}

/** Cookies del BFF. La de sesión es HttpOnly; la de CSRF debe poder leerla el JavaScript del Admin shell. */
export class SessionCookies {
  constructor(private readonly settings: CookieSettings) {}

  get names(): CookieNames {
    return this.settings.names;
  }

  setSession(reply: FastifyReply, issued: IssuedSession): void {
    const base = {
      path: '/',
      secure: this.settings.secure,
      sameSite: 'lax' as const,
      maxAge: issued.maxAgeSeconds,
    };
    reply.setCookie(this.settings.names.session, issued.cookieValue, { ...base, httpOnly: true });
    reply.setCookie(this.settings.names.csrf, issued.csrfToken, { ...base, httpOnly: false });
  }

  setLoginAttempt(reply: FastifyReply, token: string, maxAgeSeconds: number): void {
    // Lax (no Strict): el proveedor de identidad vuelve con una navegación de primer nivel.
    reply.setCookie(this.settings.names.loginAttempt, token, {
      path: '/',
      secure: this.settings.secure,
      sameSite: 'lax',
      httpOnly: true,
      maxAge: maxAgeSeconds,
    });
  }

  clearLoginAttempt(reply: FastifyReply): void {
    reply.clearCookie(this.settings.names.loginAttempt, {
      path: '/',
      secure: this.settings.secure,
    });
  }

  clearSession(reply: FastifyReply): void {
    reply.clearCookie(this.settings.names.session, { path: '/', secure: this.settings.secure });
    reply.clearCookie(this.settings.names.csrf, { path: '/', secure: this.settings.secure });
  }
}
