import * as client from 'openid-client';
import type { IdentityClaims, OidcProvider } from '../application/ports.js';

export interface OidcConfigOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Solo para desarrollo con Keycloak en http://localhost. */
  allowInsecureRequests?: boolean;
}

/**
 * Adaptador de openid-client (Authorization Code + PKCE). La librería valida firma, emisor, audiencia,
 * `state`, `nonce` y PKCE; aquí solo se traduce su resultado a las claims que usa la aplicación.
 */
export class OpenIdClientProvider implements OidcProvider {
  private configuration: Promise<client.Configuration> | null = null;

  constructor(private readonly options: OidcConfigOptions) {}

  private config(): Promise<client.Configuration> {
    this.configuration ??= client.discovery(
      new URL(this.options.issuer),
      this.options.clientId,
      this.options.clientSecret,
      undefined,
      this.options.allowInsecureRequests ? { execute: [client.allowInsecureRequests] } : undefined,
    );
    return this.configuration;
  }

  async createAuthorization(params: { redirectUri: string }) {
    const config = await this.config();
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: params.redirectUri,
      scope: 'openid profile email',
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url: url.toString(), state, nonce, codeVerifier };
  }

  async completeAuthorization(params: {
    callbackUrl: URL;
    expectedState: string;
    nonce: string;
    codeVerifier: string;
  }): Promise<IdentityClaims> {
    const config = await this.config();
    const tokens = await client.authorizationCodeGrant(config, params.callbackUrl, {
      pkceCodeVerifier: params.codeVerifier,
      expectedState: params.expectedState,
      expectedNonce: params.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new Error('El proveedor no devolvió id_token.');

    const authTime =
      typeof claims.auth_time === 'number' ? new Date(claims.auth_time * 1000) : null;
    const amr = Array.isArray(claims.amr)
      ? (claims.amr as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    return {
      issuer: claims.iss,
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : null,
      amr,
      authTime,
    };
  }
}
