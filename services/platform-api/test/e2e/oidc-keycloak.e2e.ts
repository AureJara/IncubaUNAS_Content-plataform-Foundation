// Prueba de extremo a extremo del login OIDC contra un Keycloak REAL (Authorization Code + PKCE).
// No corre en `pnpm test`: necesita `docker compose up keycloak` y la Platform API en marcha.
//
//   pnpm --filter @incubaunas/platform-api e2e:oidc
//
// Recorre el flujo igual que un navegador: BFF → Keycloak (formulario) → callback del BFF → sesión.
const API = process.env.PLATFORM_API_URL ?? 'http://localhost:4000';
const RETURN_TO = (process.env.OIDC_RETURN_TO_ALLOWLIST ?? 'http://localhost:3000/')
  .split(',')[0]!
  .trim();
const USER = process.env.E2E_USER ?? 'owner.dev';
const PASSWORD = process.env.E2E_PASSWORD ?? 'dev-only-password';

class Jar {
  private readonly cookies = new Map<string, string>();
  absorb(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, ...value] = pair!.split('=');
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(line)) this.cookies.delete(name!);
      else this.cookies.set(name!, value.join('='));
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  get(name: string): string | undefined {
    return this.cookies.get(name);
  }
}

const jar = new Jar();
const keycloakJar = new Jar();

async function hop(url: string, init: RequestInit & { jar?: Jar } = {}): Promise<Response> {
  const { jar: use = jar, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    redirect: 'manual',
    headers: {
      ...(rest.headers as Record<string, string>),
      ...(use.header() ? { cookie: use.header() } : {}),
    },
  });
  use.absorb(response);
  return response;
}

const step = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exit(1);
};

// 1) El BFF crea state/nonce/PKCE y redirige al proveedor
const start = await hop(`${API}/auth/login?return_to=${encodeURIComponent(RETURN_TO)}`);
const authorizeUrl = new URL(start.headers.get('location')!);
step(
  'BFF redirige a Keycloak',
  start.status === 302 && authorizeUrl.pathname.includes('/protocol/openid-connect/auth'),
);
step(
  'usa PKCE S256 con state y nonce',
  authorizeUrl.searchParams.get('code_challenge_method') === 'S256' &&
    !!authorizeUrl.searchParams.get('state') &&
    !!authorizeUrl.searchParams.get('nonce'),
);
step('guarda el intento en una cookie HttpOnly propia', !!jar.get('__Host-oidc'));
step(
  'el intento de login no es legible en la URL',
  !authorizeUrl.search.includes(jar.get('__Host-oidc')!),
);

// 2) Keycloak muestra su formulario
const form = await hop(authorizeUrl.toString(), { jar: keycloakJar });
const html = await form.text();
const action = /<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/
  .exec(html)?.[1]
  ?.replaceAll('&amp;', '&');
step('Keycloak muestra el formulario de login', form.status === 200 && !!action);

// 3) Se envían las credenciales de desarrollo del realm local
const submitted = await hop(action!, {
  method: 'POST',
  jar: keycloakJar,
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: USER, password: PASSWORD, credentialId: '' }),
});
const callback = submitted.headers.get('location');
step(
  'Keycloak acepta las credenciales y vuelve al BFF',
  submitted.status === 302 && !!callback?.startsWith(`${API}/auth/callback`),
  callback ? new URL(callback).pathname : `HTTP ${submitted.status}`,
);

// 4) El BFF valida state/nonce/PKCE/firma y crea la sesión
const completed = await hop(callback!);
const returnedTo = completed.headers.get('location');
step(
  'el BFF completa el login y redirige al destino permitido',
  completed.status === 302 && returnedTo === RETURN_TO,
  `${completed.status} → ${returnedTo}`,
);
step(
  'emite la cookie de sesión y la de CSRF',
  !!jar.get('__Host-session') && !!jar.get('__Host-csrf'),
);
step('descarta la cookie del intento de login', jar.get('__Host-oidc') === undefined);

// 5) La sesión funciona y el intento no se puede repetir
const me = await hop(`${API}/platform/v1/me`);
const profile = (await me.json()) as {
  user_id?: string;
  email?: string | null;
  roles?: string[];
  active_organization_id?: string | null;
};
step(
  'GET /platform/v1/me con la sesión nueva',
  me.status === 200 && !!profile.user_id,
  `email=${profile.email}`,
);

const replay = await hop(callback!);
step('repetir el mismo callback es rechazado (intento de un solo uso)', replay.status === 401);

const csrf = jar.get('__Host-csrf')!;
const noCsrf = await hop(`${API}/auth/logout`, { method: 'POST' });
step('logout sin CSRF es rechazado', noCsrf.status === 403);
const logout = await hop(`${API}/auth/logout`, {
  method: 'POST',
  headers: { 'x-csrf-token': csrf },
});
step('logout con CSRF cierra la sesión', logout.status === 204);
const after = await hop(`${API}/platform/v1/me`);
step('la sesión cerrada ya no sirve', after.status === 401);

console.log('\nLogin OIDC verificado de punta a punta contra Keycloak.');
