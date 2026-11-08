# @incuba/authz

Verifica los tokens internos que firma el gateway y decide si quien llama puede ejecutar una operación (spec 1.6, 3.6
y 9.9). Es el paquete que usan los equipos 2–4 para proteger sus APIs.

> Estado: versión 0.1.0, todavía sin publicar en un registro (F0-08). Mientras tanto se usa desde el workspace. En local
> el gateway firma con una clave de desarrollo en memoria y una sesión de prueba (MOCK-05); el login real llega con
> F1-03 y F1-05.

## Cómo llega un request

1. El navegador habla solo con el gateway, con la cookie de sesión.
2. El gateway quita la cookie, firma un token interno para la audiencia del servicio destino y lo manda en
   `Authorization: Bearer <token>`.
3. El servicio verifica el token con este paquete y aplica `x-required-scope`, `x-required-role` y `x-recent-mfa` del
   contrato.

El servicio nunca lee la cookie, ni acepta el tenant en la query, en un header o en el cuerpo: el tenant sale del token
(RN-05).

## Verificar un token

```ts
import { createTokenVerifier, TokenError } from '@incuba/authz';

const verify = createTokenVerifier({
  issuer: process.env.GATEWAY_ISSUER, // p. ej. http://localhost:8080
  audience: 'platform-api', // la audiencia de tu servicio, exacta
  keys: new URL(process.env.GATEWAY_JWKS_URL), // http://localhost:8080/.well-known/jwks.json
});

try {
  const claims = await verify(bearerToken);
  // claims.sub, claims.organization_id, claims.roles, claims.scopes...
} catch (error) {
  if (error instanceof TokenError) {
    // responde 401 con Problem Details y `WWW-Authenticate: Bearer error="invalid_token"`
  }
}
```

El JWKS se pide por HTTP y se guarda en caché (10 min; como mucho una nueva consulta cada 30 s si aparece un `kid`
desconocido). En pruebas, `keys` acepta un resolvedor de jose, como `createLocalJWKSet(jwks)`.

Si tu servicio no está en TypeScript, la verificación equivale a esto:

| Comprobación | Valor                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------- |
| Algoritmo    | `ES256` únicamente                                                                       |
| `iss`        | El emisor del gateway, exacto                                                            |
| `aud`        | Un texto igual a tu audiencia; una lista se rechaza                                      |
| Vigencia     | `exp` vigente, `iat` de hace menos de 305 s; tolerancia de reloj de 5 s                  |
| Claves       | JWKS del gateway, por `kid`                                                              |
| Claims       | Los de la tabla siguiente, con su tipo; `membership_id` sin `organization_id` se rechaza |

## Claims (spec 9.9)

| Claim             | Tipo            | Notas                                                                    |
| ----------------- | --------------- | ------------------------------------------------------------------------ |
| `iss`             | texto           | Emisor del gateway                                                       |
| `sub`             | texto           | ID del usuario                                                           |
| `sid`             | texto           | ID de la sesión del BFF                                                  |
| `organization_id` | texto, opcional | Organización activa. Falta antes de elegir una (`GET /me/organizations`) |
| `membership_id`   | texto, opcional | Membresía en esa organización                                            |
| `roles`           | lista de textos | Roles en la organización activa                                          |
| `scopes`          | lista de textos | Los que dan esos roles (tabla de abajo)                                  |
| `aud`             | texto           | `platform-api` o `content-api`; los equipos 2–4 recibirán la suya        |
| `amr`             | lista de textos | Métodos de autenticación; `mfa` si hubo segundo factor                   |
| `auth_time`       | segundos        | Momento del último login                                                 |
| `iat`, `exp`      | segundos        | Emisión y vencimiento; TTL de 300 s                                      |
| `jti`             | texto           | ID único del token                                                       |

## Roles y scopes (spec 1.6)

| Rol                    | Scopes                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `org_owner`            | Todos                                                                                                 |
| `security_admin`       | `organizations:admin`                                                                                 |
| `site_editor`          | `sites:write`, `sites:publish`                                                                        |
| `event_manager`        | `events:write`, `events:publish`, `participation:read`, `participation:manage`, `communications:send` |
| `application_reviewer` | `participation:read`                                                                                  |
| `checkin_staff`        | `onsite:checkin`                                                                                      |
| `checkin_supervisor`   | `onsite:checkin`, `onsite:void`                                                                       |
| `report_viewer`        | `reports:read`                                                                                        |

`ROLE_SCOPES` y `scopesForRoles(roles)` exponen esta tabla. `platform_admin` no es un rol de tenant: mientras
Arquitectura no defina cómo se representa (spec 12, punto abierto 7), viaja en `roles` como uno más. El mapeo está
pendiente de confirmar con los equipos 2–4 (C-14).

## Decidir el acceso

```ts
import { checkRequirement } from '@incuba/authz';

const decision = checkRequirement(
  { roles: claims.roles, scopes: claims.scopes, amr: claims.amr, authTime: claims.auth_time },
  { scope: 'events:write', role: undefined, recentMfa: false }, // de x-required-scope, x-required-role, x-recent-mfa
  Math.floor(Date.now() / 1000),
);
// 'ok' | 'forbidden' | 'recent_auth_required'
```

- **Scope**: debe estar en `scopes`.
- **Rol**: debe estar en `roles`, o el llamador debe ser `org_owner`. `platform_admin` solo lo cumple `platform_admin`.
- **MFA reciente**: `amr` incluye `mfa` y `auth_time` es de hace 600 s o menos (`RECENT_MFA_SECONDS`).

`forbidden` y `recent_auth_required` se responden con 403 y ese `code` en Problem Details (spec 9.7).

En los servicios de este repositorio, `@incuba/http-kit` hace todo esto por cada operación del contrato:
`createBearerSecurity` con `principalFromClaims` y `requirementOf` (ver `services/platform-api/src/app.ts`).

## Firmar (solo el gateway)

`createTokenSigner({ issuer, privateKey, kid, clock, newId })` firma con ES256 y el `kid` en la cabecera. Ningún otro
servicio firma tokens internos.
