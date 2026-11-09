# Cobertura

Qué está hecho, a medias o pendiente, y en qué estado responde cada operación (spec 3.8). Se actualiza en cada cambio
(CLAUDE.md, DoD de la sección 7).

Última actualización: 2026-11-08, Sprint 0: backend en mock y los dos frontends (`web-public` y `admin-shell`) leyendo
esos mocks.

## Resumen

- Las 68 operaciones de los cuatro contratos responden. 59 lo hacen con el ejemplo del contrato (`example`), 1 con un
  adaptador en memoria (`memory`) y 8 son reales: los health.
- **Ninguna historia funcional está hecha.** Un mock no es trabajo terminado (MOCK-07): las historias de las fases 1–5
  siguen pendientes hasta que sus operaciones estén en `real`.
- Los frontends existen pero solo muestran datos de prueba: el sitio público pinta lo que devuelve la Public Read API en
  mock y el shell, la sesión de prueba del gateway. Los dos lo avisan en pantalla. Ver [Frontends](#frontends).
- `pnpm check` está en verde: lint de contratos, `contracts:check`, ESLint, Prettier, `tsc` y 130 pruebas en 11
  archivos.

## Estados

| Estado    | Qué responde                                                   | Cuántas |
| --------- | -------------------------------------------------------------- | ------: |
| `example` | El primer ejemplo de la respuesta 2XX/3XX; `Prefer: example=<nombre>` elige otro | 59 |
| `memory`  | El caso de uso sobre adaptadores en memoria                    |       1 |
| `real`    | El caso de uso completo                                        |       8 |

Toda respuesta que no es `real` lleva `X-Mock`. `GET /health/ready` de cada servicio lista el estado de sus
operaciones. Con `APP_ENV=staging` o `production` ningún servicio arranca mientras tenga una operación en `example` o
`memory`, o la sesión de prueba (MOCK-06); hoy eso significa que **ningún servicio arranca fuera de local y CI**.

## Sprint 0

| Ítem  | Estado    | Qué hay                                                                                                   | Qué falta |
| ----- | --------- | --------------------------------------------------------------------------------------------------------- | --------- |
| F0-01 | Hecho     | Monorepo pnpm, TypeScript estricto, ESLint con fronteras de capas, Prettier, `.gitattributes`, `.editorconfig`, `.nvmrc`, CODEOWNERS, ADR-0001. `tests/architecture` prueba que `pg` en `domain/` falla el lint | — |
| F0-02 | Pendiente | `.env.example` sin secretos                                                                               | Docker Compose con PostgreSQL, Keycloak, Redis, Redpanda, MinIO, ClamAV y Mailpit; `pnpm dev:up` |
| F0-03 | Parcial   | Cuatro contratos OpenAPI 3.1 con las 62 rutas del catálogo (lo comprueba `contracts:check`), scopes, Problem Details y un ejemplo por respuesta por defecto y por cuerpo, validados contra su schema | Spectral; marcar en el contrato las adiciones de spec 9.6 como propuestas (hoy solo se anotan en esta tabla); registrar los códigos de error nuevos (C-07) |
| F0-04 | Pendiente | —                                                                                                         | AsyncAPI y JSON Schemas de los eventos |
| F0-05 | Parcial   | `pnpm contracts:build` genera los JSON empaquetados y los tipos del `api-client`; `contracts:check` falla si quedaron desactualizados | El workflow de CI; la documentación navegable con Redoc (`contracts/docs/` está vacío) |
| F0-06 | Hecho     | `shared-kernel` y `http-kit`: Problem Details, request ID (UUID v7), idempotencia, ETag/`If-Match` (428 y 412), cursor, validación de request y response con el OpenAPI, rutas por `operationId` | El almacén de idempotencia es en memoria hasta F0-07 |
| F0-07 | Pendiente | —                                                                                                         | `tenancy-pg`, migraciones, RLS, outbox, inbox |
| F0-08 | Parcial   | `authz`: verificación con JWKS por HTTP y caché, claims, rol → scopes, scope, rol y MFA reciente; `http-kit` lo aplica por operación. Audiencia incorrecta → 401 y scope faltante → 403 están probados. README para los equipos 2–4 | Helpers de sitio y evento; fijar la RLS con el tenant de los claims (F0-07); publicar el paquete versionado; confirmar el mapeo con los equipos 2–4 (C-14) |
| F0-09 | Pendiente | —                                                                                                         | `events`, outbox relay, inbox, `EventBus` |
| F0-10 | Pendiente | Adelanto: el logger redacta `Authorization`, cookies, `Set-Cookie`, tokens en la URL y `code`/`state` en la query | OpenTelemetry; la prueba que busca tokens y correos en los logs |
| F0-11 | Parcial   | Configuración tipada que junta todos los errores y no arranca si falta una variable; `live` y `ready` en cada servicio; cierre con `SIGTERM` y 503 mientras cierra | Prueba del drenaje; los checks de `ready` de cada dependencia real a medida que existan |
| F0-12 | Parcial   | `gateway`, `platform-api`, `content-api` (procesos `cms` y `public-read`) arrancan, exponen health y validan contra su contrato. `web-public` (SSR) y `admin-shell` (modo datos) leen las APIs en mock con el `api-client` desde sus loaders; los dos compilan y se probaron en el navegador bajo su CSP real | El proceso `projector`; medir el JavaScript inicial en CI (a mano, la portada carga hoy 7 archivos y 109,7 KB gzip) |
| F0-13 | Pendiente | `contracts:check` busca secretos conocidos (PEM, JWT, AWS, GitHub, Stripe, Slack) en el repositorio       | Pipeline de CI, gitleaks, SBOM, Trivy, imágenes sin root, `main` protegida |
| F0-14 | Pendiente | Este archivo                                                                                              | Seed de demo y `pnpm seed` |
| F0-15 | Parcial   | `packages/ui`: tokens Nexus Horizon del diseño de Stitch en el `@theme` de Tailwind 4, Inter y Plus Jakarta Sans autoalojadas (Fontsource), íconos de Material Symbols copiados como SVG en línea (Apache 2.0). `packages/ui/test/contrast.test.ts` comprueba AA (4,5:1) en los 16 pares de texto y fondo que se usan | Cerrar C-09 con el integrante de frontend; el logo oficial (hoy es un logo de texto); el tema por sitio (ver [Frontends](#frontends)) |
| F0-16 | Parcial   | Mock de contrato en `http-kit`, `Prefer: example=`, `X-Mock`, `DATA_SOURCE`, estados en `ready` y aquí; un servicio con mocks no arranca en staging (probado) | Prueba HTTP de las 68 operaciones (hoy se valida cada ejemplo contra su schema, no la respuesta servida); que la CI confirme que la imagen de producción no lleva mocks; los adaptadores en memoria llegan con cada caso de uso |
| F0-17 | Parcial   | El gateway emite un token interno ES256 con una clave de desarrollo, para el usuario ficticio y el rol de `MOCK_ROLE`; platform-api y el CMS lo validan con `authz` y aplican los scopes (prueba de integración). En staging no arranca | El usuario ficticio está fijo en `services/gateway/src/infrastructure/test-session.ts` hasta que exista el seed (F0-14) |

## Frontends

Los dos usan React Router 8.5.1 sin APIs `unstable_`, React Router como única capa de datos (ESLint prohíbe TanStack,
SWR, Redux y axios) y los tokens de `packages/ui`. Ninguno escribe HTML crudo ni carga nada de otro origen: fuentes e
íconos son locales y los enlaces del CMS pasan por `safeHref` (solo `/…` del mismo sitio o `https:` sin credenciales).

### `web-public` (puerto 3000)

| Qué                                                                                                                         | Estado  |
| --------------------------------------------------------------------------------------------------------------------------- | ------- |
| SSR en modo framework; un middleware de servidor resuelve el host con `resolveSite` y guarda el sitio en el contexto | Hecho   |
| Rutas `/`, `/eventos/:eventSlug` y `/*` (página del CMS); una ruta con mayúsculas o `//` da 404 sin llamar a la API       | Hecho   |
| Título en toda página (WCAG 2.4.2), también en las de error: "Página no encontrada · {sitio}" o "El sitio no está disponible" | Hecho   |
| Bloques `hero`, `rich_text`, `event_catalog` y `featured_event`, con una llamada a eventos por bloque de catálogo          | Hecho   |
| Bloques `image` y `agenda`: no se pintan (no hay assets ni sesiones en el mock)                                            | Pendiente |
| `Cache-Control` del recurso principal y unión de `Surrogate-Key`; todo error sale con `no-store` y sin claves              | Hecho   |
| CSP con el hash sha256 de cada script en línea, sin `unsafe-inline` en producción; `nosniff`, `Referrer-Policy`, COOP      | Hecho   |
| Detalle de evento con descripción, agenda y programas; la inscripción es un aviso hasta la isla del Equipo 3              | Parcial |
| Tema por sitio (`theme` de `PublicSite`): hoy se ignora; aplicarlo con estilos en línea rompería la CSP                    | Pendiente |
| `/preview/[token]`, `/eventos` (listado), pre-render de la landing, eventos cancelados (F2-12)                             | Pendiente |

`server.ts` sirve la compilación con Express: `/assets` con caché inmutable de un año, el resto de archivos con una hora
y nunca el código fuente (`/.env` y `/server.ts` dan 404).

### `admin-shell` (puerto 5173)

| Qué                                                                                                                       | Estado    |
| ------------------------------------------------------------------------------------------------------------------------- | --------- |
| Marco del diseño (cabecera, menú lateral y móvil, pie) con `getMe`; el aviso "Datos de prueba" sale cuando hay `X-Mock`  | Hecho     |
| Middleware de sesión en la raíz: 401 → `/auth/login?return_to=…` con recarga completa                                     | Hecho     |
| Organización activa en la URL (`/o/{slug}`); otra organización da 404; capability por ruta (`sites:write` → 403 sin llamar al CMS) | Hecho |
| Panel principal y Sitios web (`listSites`)                                                                                | Hecho     |
| Módulos de otros equipos (convocatorias, crear convocatoria, postulantes, participaciones) y los de fases futuras: pantalla "Módulo aún no montado" | Hecho |
| Errores: solo el `request_id`, nunca el detalle del Problem                                                               | Hecho     |
| Logout y CSRF (el botón está deshabilitado), cambio de organización, breadcrumbs (F1-10)                                  | Pendiente |
| Que el gateway sirva el shell compilado; hoy Vite reenvía `/auth`, `/platform/v1`, `/cms/v1` y `/.well-known` al gateway | Pendiente |

La CSP del shell (`script-src 'self'`, sin nada en línea) solo se aplica en `vite preview`; en producción la pondrá
quien sirva los archivos. El formulario de convocatoria del diseño de Stitch es del Equipo 2 y no se montó.

## Estado por operación

"9.6" marca las adiciones propuestas al catálogo que todavía no están registradas.

### Gateway (`contracts/openapi/auth.yaml`)

| Operación           | Ruta                          | Estado    | Nota |
| ------------------- | ----------------------------- | --------- | ---- |
| `getHealthLive`     | `GET /health/live`            | `real`    | 9.6 |
| `getHealthReady`    | `GET /health/ready`           | `real`    | 9.6; check `signing_key` |
| `startLogin`        | `GET /auth/login`             | `example` | F1-03 |
| `completeLogin`     | `GET /auth/callback`          | `example` | F1-03 |
| `refreshSession`    | `POST /auth/refresh`          | `example` | |
| `logout`            | `POST /auth/logout`           | `example` | |
| `logoutAll`         | `POST /auth/logout-all`       | `example` | |
| `getJwks`           | `GET /.well-known/jwks.json`  | `memory`  | 9.6; clave de desarrollo que cambia en cada arranque (F1-05) |
| `issueServiceToken` | `POST /oauth/token`           | `example` | 9.6 |

Además el gateway reenvía, con la sesión de prueba y un token interno para la audiencia correcta:
`/platform/v1/*` y `/public/v1/invitations/*` a platform-api, `/cms/v1/*` al CMS, y `POST
/public/v1/sites/{slug}/leads` a platform-api sin token.

### Platform API (`contracts/openapi/platform.yaml`)

| Operación                  | Ruta                                                     | Estado    | Nota |
| -------------------------- | -------------------------------------------------------- | --------- | ---- |
| `getHealthLive`            | `GET /health/live`                                       | `real`    | 9.6 |
| `getHealthReady`           | `GET /health/ready`                                      | `real`    | 9.6 |
| `getMe`                    | `GET /platform/v1/me`                                    | `example` | |
| `getMyCapabilities`        | `GET /platform/v1/me/capabilities`                       | `example` | |
| `listMySessions`           | `GET /platform/v1/me/sessions`                           | `example` | |
| `revokeSession`            | `DELETE /platform/v1/me/sessions/{id}`                   | `example` | |
| `listMyOrganizations`      | `GET /platform/v1/me/organizations`                      | `example` | |
| `switchSessionContext`     | `POST /platform/v1/session-context`                      | `example` | |
| `listRoles`                | `GET /platform/v1/roles`                                 | `example` | 9.6 |
| `createOrganization`       | `POST /platform/v1/organizations`                        | `example` | |
| `getOrganization`          | `GET /platform/v1/organizations/{id}`                    | `example` | |
| `updateOrganization`       | `PATCH /platform/v1/organizations/{id}`                  | `example` | |
| `suspendOrganization`      | `POST /platform/v1/organizations/{id}/suspensions`       | `example` | |
| `reactivateOrganization`   | `POST /platform/v1/organizations/{id}/reactivations`     | `example` | 9.6 |
| `listMemberships`          | `GET /platform/v1/organizations/{id}/memberships`        | `example` | |
| `updateMembership`         | `PATCH /platform/v1/memberships/{id}`                    | `example` | |
| `listInvitations`          | `GET /platform/v1/organizations/{id}/invitations`        | `example` | 9.6 |
| `createInvitation`         | `POST /platform/v1/organizations/{id}/invitations`       | `example` | |
| `revokeInvitation`         | `POST /platform/v1/invitations/{id}/revocations`         | `example` | 9.6 |
| `acceptInvitation`         | `POST /public/v1/invitations/{token}/acceptance`         | `example` | |
| `declineInvitation`        | `POST /public/v1/invitations/{token}/declination`        | `example` | |
| `listOrganizationSessions` | `GET /platform/v1/organizations/{id}/sessions`           | `example` | 9.6 |
| `listServiceAccounts`      | `GET /platform/v1/organizations/{id}/service-accounts`   | `example` | 9.6 |
| `createServiceAccount`     | `POST /platform/v1/organizations/{id}/service-accounts`  | `example` | |
| `rotateServiceAccount`     | `POST /platform/v1/service-accounts/{id}/rotations`      | `example` | |
| `revokeServiceAccount`     | `POST /platform/v1/service-accounts/{id}/revocations`    | `example` | |
| `listDomains`              | `GET /platform/v1/sites/{id}/domains`                    | `example` | 9.6 |
| `createDomain`             | `POST /platform/v1/sites/{id}/domains`                   | `example` | |
| `verifyDomain`             | `POST /platform/v1/domains/{id}/verifications`           | `example` | |
| `listAuditEvents`          | `GET /platform/v1/organizations/{id}/audit-events`       | `example` | 9.6 |
| `createLead`               | `POST /public/v1/sites/{slug}/leads`                     | `example` | 9.6 |

### Content API, proceso `cms` (`contracts/openapi/cms.yaml`)

| Operación             | Ruta                                          | Estado    | Nota |
| --------------------- | --------------------------------------------- | --------- | ---- |
| `getHealthLive`       | `GET /health/live`                            | `real`    | 9.6 |
| `getHealthReady`      | `GET /health/ready`                           | `real`    | 9.6 |
| `listSites`           | `GET /cms/v1/sites`                           | `example` | 9.6 |
| `createSite`          | `POST /cms/v1/sites`                          | `example` | |
| `getSite`             | `GET /cms/v1/sites/{id}`                      | `example` | |
| `updateSite`          | `PATCH /cms/v1/sites/{id}`                    | `example` | |
| `putSiteTheme`        | `PUT /cms/v1/sites/{id}/theme`                | `example` | 9.6 |
| `putSiteNavigation`   | `PUT /cms/v1/sites/{id}/navigation`           | `example` | 9.6 |
| `listPages`           | `GET /cms/v1/sites/{id}/pages`                | `example` | 9.6 |
| `createPage`          | `POST /cms/v1/sites/{id}/pages`               | `example` | |
| `getPage`             | `GET /cms/v1/pages/{id}`                      | `example` | |
| `updatePage`          | `PATCH /cms/v1/pages/{id}`                    | `example` | |
| `createPreviewToken`  | `POST /cms/v1/pages/{id}/preview-tokens`      | `example` | |
| `listPublications`    | `GET /cms/v1/pages/{id}/publications`         | `example` | 9.6 |
| `publishPage`         | `POST /cms/v1/pages/{id}/publications`        | `example` | |
| `restorePublication`  | `POST /cms/v1/pages/{id}/restorations`        | `example` | |
| `createMediaUpload`   | `POST /cms/v1/media-uploads`                  | `example` | |
| `completeMediaUpload` | `POST /cms/v1/media/{id}/completion`          | `example` | |
| `listMedia`           | `GET /cms/v1/media`                           | `example` | 9.6 |

### Content API, proceso `public-read` (`contracts/openapi/public.yaml`)

| Operación            | Ruta                                               | Estado    | Nota |
| -------------------- | -------------------------------------------------- | --------- | ---- |
| `getHealthLive`      | `GET /health/live`                                 | `real`    | 9.6 |
| `getHealthReady`     | `GET /health/ready`                                | `real`    | 9.6 |
| `resolveSite`        | `GET /public/v1/site-resolutions`                  | `example` | 9.6 |
| `getPublicSite`      | `GET /public/v1/sites/{slug}`                      | `example` | |
| `listPublishedPages` | `GET /public/v1/sites/{slug}/pages`                | `example` | 9.6 |
| `getPublicPage`      | `GET /public/v1/sites/{slug}/pages/{path}`         | `example` | `{path}` va codificado (`%2F`) |
| `listPublicEvents`   | `GET /public/v1/sites/{slug}/events`               | `example` | |
| `getPublicEvent`     | `GET /public/v1/sites/{slug}/events/{event_slug}`  | `example` | |
| `getPreview`         | `GET /public/v1/previews/{token}`                  | `example` | 9.6 |

## Huecos y decisiones abiertas

- **Códigos de error sin registrar en spec 9.7** (C-07): `bad_request`, `precondition_required`, `unauthorized`,
  `forbidden`, `not_found`, `rate_limited`, `unsupported_media_type`, `payload_too_large`, `request_in_progress`,
  `internal_error`, `service_unavailable`. Los usa `http-kit`.
- **`platform_admin`**: viaja en `roles` como un rol más hasta que Arquitectura decida (spec 12, punto abierto 7).
- **Sesión de prueba**: no exige CSRF y su `auth_time` es siempre "ahora", así que cumple cualquier MFA reciente.
- **Claves**: la clave de firma del gateway vive en memoria y cambia en cada arranque; F1-05 la hace rotable con `kid`.
- **Idempotencia**: en memoria hasta F0-07; se pierde al reiniciar y no se comparte entre réplicas.
- **Seguridad opcional**: si un contrato declara una alternativa vacía en `security`, `http-kit` trata la operación como
  anónima y no lee el token aunque llegue. Hoy ninguna operación combina las dos cosas.
- **Public Read API**: el gateway no la reenvía; en local se llama directo (puerto 8083), como hará la CDN.
- **Cambios de contrato hechos al conectar los frontends** (contrato primero, `contracts:lint` y `contracts:build`):
  - Los `href` de `Link` (cms.yaml), la navegación (public.yaml) y los bloques `hero` y `rich_text` ya no aceptan
    `//host` ni `/\host`: el patrón anterior (`^/…`) dejaba pasar enlaces a otro dominio relativos al protocolo.
  - `Block` (en cms.yaml y en public.yaml) ya no declara `discriminator`: el implícito tomaba el nombre del schema (`hero.v1`) en vez
    del valor de `type` (`hero`) y los tipos generados no servían. Los distinguen las constantes `type` y `version`.
- **`Surrogate-Key` sin ejemplo**: `components/headers/SurrogateKey` (common.yaml) no tiene ejemplo, así que el mock no
  la envía y el sitio público hoy no propaga ninguna clave. El formato de las claves queda para F2-12; no se inventó.
- **Excepciones de Redocly** (`contracts/.redocly.lint-ignore.yaml`): los health no tienen respuestas 4XX y el login y
  el callback responden 302 sin 2XX. Revisadas a mano.

## Cómo verificarlo

```bash
pnpm check
```

Para levantarlo en local, copia `.env.example` a `.env` y arranca cada servicio en su terminal:

```bash
pnpm dev:gateway
```

```bash
pnpm dev:platform
```

```bash
pnpm dev:cms
```

```bash
pnpm dev:public
```

`GET http://localhost:8080/health/ready` lista el estado de cada operación del gateway; cada servicio hace lo mismo en
su puerto. Por el gateway, `GET http://localhost:8080/platform/v1/me` responde el mock con la sesión de prueba.

Con las APIs levantadas, los frontends:

```bash
pnpm dev:web
```

```bash
pnpm dev:admin
```

El sitio público queda en `http://localhost:3000` y el shell en `http://localhost:5173` (redirige a
`/o/incubaunas-demo`).
