# Backlog — Equipo 1: Content & Platform Foundation

> Backlog de trabajo para desarrollar **solo** la parte del Equipo 1 de la plataforma de eventos de IncubaUNAS.
> Desglosa las 40 historias del backlog canónico (PF-001 a PF-055) en ítems implementables, ordenados por fase y sprint.
>
> **Fuente:** `spec.md` v1.3 (no se publica en el repositorio) y [event-platform-architecture](https://github.com/juancxdev/event-platform-architecture)
> (commit `df94d0b`). **Versión:** 1.2 (2026-11-08): React Router 8 en todo el frontend y APIs con mocks desde el
> Sprint 0 (F0-16, F0-17). La 1.1 pasó el sitio público a React.

## 1. Cómo leer este backlog

- **ID:** `F{fase}-{nn}` para el trabajo del equipo y `C-{nn}` para los acuerdos con otros equipos. Los acuerdos no son
  código de otros equipos: son contratos que necesitamos cerrar antes de un ítem.
- **PF:** historia del backlog canónico que cubre el ítem. Una historia puede repartirse en varios ítems.
- **Par:** **P** = Platform (identidad, gateway, plataforma) · **E** = Experience (CMS, sitios, shell) · **A** = ambos.
  Es el reparto en dos pares que recomienda la arquitectura.
- **Tamaño (propuesta):** **S** ≤ 2 días-persona · **M** 3–5 · **L** 6–10. Ninguno es XL: lo que pase de L se divide.
  La arquitectura pide que el equipo estime en el Sprint 0, así que estos tamaños son el punto de partida de esa
  reunión, no un compromiso.
- **Sprint:** sprints de 2 semanas **(propuesta)**. La carga de cada sprint se ajusta en la planificación según la
  capacidad real del equipo.
- **Hecho cuando:** el criterio observable del ítem. Además, todo ítem cumple la Definition of Done (sección 7) y las
  reglas del spec: contrato primero, **todo se conecta mediante APIs** (spec 3.2), seguridad (spec 6) y pruebas
  negativas.

## 2. Resumen

| Sprint | Fase | Objetivo | Gate de la arquitectura que habilita | Ítems |
| --- | --- | --- | --- | --- |
| 0 | 0 — Cimientos | Monorepo, contratos, librerías compartidas, CI, entorno de desarrollo, APIs en mock | Sprint 0: contratos, OIDC, CI/CD | 17 |
| 1 | 1 — Identidad y acceso · 2 — CMS y sitio público (núcleo) | Login, gateway, shell; publicar y ver contenido y eventos | **Gate público**: publicar evento → Content lo materializa → la landing lo muestra | 12 + 12 |
| 2 | 2 — CMS (resto) · 3 — Administración de la organización | Editor en el shell, miembros, service accounts, rutas públicas para Participation | **Gate participación** (Equipo 3): su isla y su API pasan por nuestro gateway | 4 + 11 |
| 3 | 4 — Dominios, medios y landing comercial | Dominios propios, medios con antivirus, landing y demo | **Gate onsite** (Equipo 4): su PWA entra por nuestro login | 8 |
| 4 | 5 — Operación y endurecimiento | Observabilidad, DLQ, backups, carga 3×, historias posteriores al MVP | Antes de producción | 11 |

Total: 75 ítems del equipo y 16 acuerdos con otros equipos. La sección 6 muestra qué ítems cubren cada historia.

## 3. Backlog por fase

### Fase 0 — Cimientos (Sprint 0)

| ID | Ítem | PF | Par | Tamaño | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| F0-01 | Monorepo pnpm con la estructura del spec (3.3); TypeScript estricto; ESLint con fronteras de capas; Prettier; `.gitattributes` con LF, `.editorconfig`, `.nvmrc`, CODEOWNERS; ADR-0001 (todo el frontend en React) | PF-050 | A | M | — | `pnpm lint` y `pnpm typecheck` pasan; una prueba confirma que importar `pg` en `domain/` falla el lint |
| F0-02 | Entorno de desarrollo con Docker Compose: PostgreSQL (bases `platform` y `content`, roles de migración y de ejecución `NOBYPASSRLS`), Keycloak con realm de desarrollo, Redis, Redpanda con schema registry, MinIO, ClamAV, Mailpit | PF-051 | P | M | F0-01 | `pnpm dev:up` levanta todo con healthchecks; `.env.example` sin secretos reales |
| F0-03 | Contratos OpenAPI 3.1 (`auth`, `platform`, `cms`, `public`): todas las rutas del catálogo, las adiciones de spec 9.6 marcadas como propuestas, `x-required-scope`, Problem Details y un ejemplo por respuesta en `contracts/examples/` (los usa el mock, spec 3.8) | — | A | L | F0-01, C-07 | Lint (Redocly + Spectral) en verde; una prueba confirma que cada ruta del catálogo existe en el contrato |
| F0-04 | Contrato AsyncAPI 3.0 y JSON Schemas: envelope v1, los 4 topics que producimos y los 4 que consumimos (copiados del contrato de los equipos 2 y 3 en cuanto exista) | PF-053 | P | M | F0-01, C-02, C-03 | Un ejemplo válido por topic; lint en verde |
| F0-05 | Gate de contratos en CI: lint, generación de tipos, del `api-client` tipado y de la documentación navegable (Redoc) | PF-050 | A | M | F0-03 | La CI falla si el contrato no valida o si el código generado quedó desactualizado |
| F0-06 | `shared-kernel` y `http-kit`: Problem Details, request ID, idempotencia, ETag/If-Match, paginación por cursor, validación con el OpenAPI y rutas registradas por `operationId` | — | P | L | F0-03 | Misma clave → misma respuesta; otro cuerpo → 409; `If-Match` viejo → 412; una operación sin handler impide arrancar en staging y producción (en local la atiende el mock, F0-16) |
| F0-07 | `tenancy-pg` y migraciones iniciales: ejecutor forward-only, RLS forzada, política e índice tenant-first, outbox, inbox e idempotencia | PF-024 | P | M | F0-02 | Una tabla de tenant sin RLS hace fallar la CI; la prueba de dos tenants sobre el mismo pool pasa |
| F0-08 | `authz`: verificación de tokens internos (JWKS por HTTP con caché), claims, mapeo de rol a scopes, helpers de scope, rol, sitio y evento, y middleware de `x-required-scope`. Se publica como paquete versionado para los equipos 2–4 | PF-024 | P | L | F0-03, C-14 | Audience incorrecta → 401; falta un scope → 403; el tenant de los claims fija la RLS; README de uso para los otros equipos |
| F0-09 | `events`: envelope v1, relay del outbox (reintentos con jitter, lease), inbox idempotente, puerto `EventBus` con adaptador Redpanda y adaptador en memoria, DLQ | PF-053 | P | L | F0-02, F0-04, C-01 | Un duplicado no tiene efecto; un mensaje venenoso va a la DLQ sin datos personales; los dos adaptadores pasan la misma suite del puerto |
| F0-10 | `telemetry`: OpenTelemetry (trazas y métricas) y logger con redacción; IDs de request, traza y organización | PF-052 | P | M | F0-01 | Una prueba busca tokens y correos en los logs de las pruebas y no encuentra ninguno |
| F0-11 | Configuración tipada y validada al arrancar; health `live` y `ready` en cada servicio; apagado con drenaje | PF-051, PF-055 | P | S | F0-06 | Si falta un secreto, el servicio no arranca; `ready` distingue cada dependencia |
| F0-12 | Esqueletos: `gateway`, `platform-api`, `content-api` (procesos `cms`, `projector` y `public-read`), `web-public` (React Router 8, modo framework con SSR) y `admin-shell` (React Router 8, modo datos), con capas hexagonales y raíz de composición | — | A | M | F0-06, F0-07, F0-10, F0-11, F0-16 | Cada servicio arranca, expone su health y valida contra su contrato; los dos frontends leen las APIs en mock con el `api-client` desde un loader; la CI mide el JavaScript inicial del sitio |
| F0-13 | Pipeline de CI: lint, tipos, contratos, pruebas con PostgreSQL real, gitleaks, SBOM (Syft), Trivy e imágenes sin root; `main` protegida | PF-050 | A | M | F0-01 | Un PR con un secreto de prueba hace fallar la CI; las imágenes llevan SBOM |
| F0-14 | Seed de demo versionado y sin datos personales (organización, sitio y usuarios de prueba en Keycloak) y `docs/COBERTURA.md` | PF-041 | E | S | F0-07 | `pnpm seed` deja siempre el mismo estado |
| F0-15 | Design tokens y kit `ui` acordados con el integrante de frontend: versión de Tailwind, fuentes autoalojadas, colores con contraste AA | PF-038, PF-045 | E | M | C-09 | Tokens publicados; una prueba verifica el contraste AA |
| F0-16 | Mocks de las APIs (spec 3.8): mock de contrato en `http-kit` (ejemplos de `contracts/examples/`, `Prefer: example=`), `DATA_SOURCE` (`memory` o `real`) en la raíz de composición, header `X-Mock`, estado de cada operación en `ready` y en `docs/COBERTURA.md` | — | A | M | F0-03, F0-06 | Todas las operaciones del catálogo responden y su respuesta valida contra el contrato; con `APP_ENV=staging` un servicio con mocks no arranca; la CI confirma que la imagen de producción no incluye mocks |
| F0-17 | Sesión de prueba del gateway (MOCK-05): usuario ficticio del seed, rol por `MOCK_ROLE` y token interno firmado con una clave de desarrollo | — | P | S | F0-08, F0-14, F0-16 | Un servicio en mock valida ese token con `authz` y aplica los scopes del rol; la sesión de prueba no existe fuera de local y CI |

### Fase 1 — Identidad y acceso (Sprint 1, ruta crítica)

| ID | Ítem | PF | Par | Tamaño | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| F1-01 | Modelo de identidad: `users`, `identities` `(issuer, sub)`, `organizations` (máquina de estados), membresías y roles, `security_audit` append-only | PF-001, PF-012 | P | M | F0-07 | Una transición inválida → 409; el rol de ejecución no puede hacer UPDATE ni DELETE en la auditoría |
| F1-02 | Alta de organización con su primer owner: provisioning compensable e idempotente, evento `platform.organization.lifecycle_changed.v1`, rol `platform_admin` | PF-001 | P | M | F1-01, C-06 | Si falla a mitad no queda ninguna organización activa; la misma clave repite la respuesta |
| F1-03 | Login BFF: `/auth/login` y `/auth/callback` con state, nonce y PKCE del lado del servidor; allowlist de `return_to`; cookie `__Host-sid` | PF-004 | P | L | F0-02, F1-01 | Pasan los escenarios de login del spec; un `return_to` externo termina en `/` |
| F1-04 | Sesión: refresh con rotación y detección de reutilización, inactividad 8 h y vigencia 30 d, logout, logout global y CSRF | PF-005 | P | L | F1-03 | Reutilizar un refresh revoca la familia en menos de 60 s; un POST sin token CSRF → 403 |
| F1-05 | Tokens internos en el gateway: firma ES256 o EdDSA, `kid` rotable, `/.well-known/jwks.json`, TTL de 5 min y `aud` exacta | PF-023 | P | M | F0-08, F1-04 | Un servicio valida el token con `authz`; un token con otra audience → 401 |
| F1-06 | Proxy del gateway hacia `platform-api`, `content-api` y las APIs de los equipos 2–4 (configurable): request ID, `traceparent`, límites de tamaño y timeouts, CORS con allowlist, rate limit con Redis, Problem Details | PF-023 | P | L | F1-05 | Al superar el límite → 429 con `Retry-After`; un cuerpo demasiado grande → 413 |
| F1-07 | `/platform/v1/me`, `/me/capabilities`, `/me/organizations` y `/session-context` (cambiar de organización reemite la sesión) | PF-006, PF-009 | P | M | F1-04 | Cambiar a una organización sin membresía → 404; las cachés privadas quedan separadas |
| F1-08 | MFA y autenticación reciente: lectura de `amr` y `auth_time`, reautenticación en el IdP, códigos `mfa_required` y `recent_auth_required`; MFA y recuperación configurados en Keycloak | PF-007 | P | M | F1-03 | Una acción privilegiada sin MFA reciente → 403 y el shell lleva a reautenticarse |
| F1-09 | Respuestas 401/403/404 coherentes, auditoría de denegaciones y matriz base de pruebas negativas | PF-006 | P | S | F1-07 | La matriz negativa corre en CI |
| F1-10 | Shell: callback, organización activa en la URL (`/o/{slug}`), navegación por capabilities, breadcrumbs, estados de carga, vacío, error y sin acceso, logout. Rutas de React Router: middleware de sesión en la raíz, capability en `handle`, loaders y actions con el `api-client` (FE-06) | PF-044 | E | L | F1-07, F0-15 | E2E: login → shell → cambio de organización → logout |
| F1-11 | Shell: punto de montaje de módulos (paquete que exporta `RouteObject[]` con `lazy` y su manifiesto de capabilities; cliente HTTP autenticado, sin tokens) con un módulo de prueba (FE-07) | PF-044 | E | M | F1-10, C-08 | Un módulo de prueba se monta sin modificar el shell |
| F1-12 | Servicio de prueba, que solo existe en las pruebas, que valida tokens con `authz` para demostrar la llamada a otro equipo a través del gateway | PF-023 | P | S | F1-05 | Demo de la fase: el shell llama al servicio de prueba con un token de audience exacta |

### Fase 2 — CMS y sitio público (Sprint 1: núcleo y Gate público · Sprint 2: resto)

| ID | Ítem | PF | Par | Tamaño | Sprint | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F2-01 | Modelo de contenido: `sites` (tipos `product`, `demo` y `client`), `pages`, `page_drafts`, `page_publications`, `site_themes`, `navigations`, con RLS | PF-030 | E | M | 1 | F0-07 | Únicos `(organization_id, slug)` y `(site_id, path, locale)` |
| F2-02 | API CMS de sitios: crear, leer, editar con `If-Match` y listar | PF-030 | E | M | 1 | F2-01 | Pasan las pruebas negativas entre organizaciones |
| F2-03 | Registro de bloques tipados (JSON Schema por tipo y versión) con sus renderizadores; texto enriquecido restringido, sin HTML; enlaces seguros | PF-031 | E | L | 1 | F2-01 | `<script>` → 422 con pointer; ningún payload XSS se ejecuta al renderizar |
| F2-04 | API de páginas: crear, editar con `If-Match` (autosave), listar; errores por pointer | PF-031 | E | M | 1 | F2-03 | Una revisión vieja → 412 |
| F2-05 | Publicación inmutable: snapshot, hash y versión; idempotente; la anterior queda `superseded`; outbox `content.page.published.v1` | PF-034 | E | M | 1 | F2-04, F0-09 | Pasa el escenario de publicación idempotente del spec |
| F2-06 | Vista previa: token corto, de un uso y ligado al usuario; `GET /public/v1/previews/{token}` con `no-store` y `noindex` | PF-033 | E | M | 1 | F2-04 | El segundo uso → 404 |
| F2-07 | Public Read API de sitios y páginas (más la lista de rutas para el sitemap) con `ETag`, `Cache-Control` y `Surrogate-Key`, sin `Set-Cookie`, y rol de base de datos de solo lectura | PF-042, PF-046 | E | M | 1 | F2-05 | Ninguna respuesta lleva cookies; una prueba confirma que el rol no puede escribir |
| F2-08 | Resolución de host y slug a sitio (`/public/v1/site-resolutions`): canonización y función privilegiada mínima | PF-022 | P | M | 1 | F2-01 | Pasan las pruebas negativas de PF-022 |
| F2-09 | Proyector de eventos: `release_published` (descargar el manifiesto, verificar el hash, `pending` → `active` atómico), `event.cancelled`, `schedule.changed` y `availability.changed`, con inbox y replay | PF-037, PF-042 | E | L | 1 | F0-09, C-02, C-03 | Pasan los escenarios de proyección del spec con fixtures del contrato del Equipo 2 |
| F2-10 | Public Read API de eventos: catálogo con filtros y cursor, y detalle coherente por `publication_id` | PF-042 | E | M | 1 | F2-09 | Todo el detalle sale de la misma publicación |
| F2-11 | Purga del CDN por surrogate key, reintentable (en desarrollo, un proxy de caché local con purga) | PF-046 | E | S | 1 | F2-05 | Si la purga falla se reintenta; la caché no mezcla hosts |
| F2-12 | `web-public`: layout del diseño y rutas `/`, `/eventos`, `/eventos/[slug]`, `/[...slug]`, `/preview/[token]`. SSR con React Router: un middleware de servidor resuelve el host al sitio, los loaders leen la Public Read API con el `api-client` y `headers` fija `Cache-Control` y `Surrogate-Key`; pre-render de la landing; locale y zona del evento; 404 y cancelado; CSP estricta con hash de los scripts de hidratación y `assetsInlineLimit: 0` | PF-042, PF-043 | E | L | 1 | F2-07, F2-10, F0-15 | La prueba de humo del sitio compilado pasa bajo su CSP real y el JavaScript inicial queda bajo 120 KB gzip. **Cierra el Gate público** |
| F2-13 | Bloques de catálogo, evento destacado y agenda: guardan un filtro o ID más la publicación, no una copia | PF-037 | E | M | 2 | F2-03, F2-10 | Hay estados vacío y de error |
| F2-14 | Slot de la isla de registro del Equipo 3: componente React cargado de forma diferida, solo en el navegador, dentro de un error boundary con fallback | PF-043 | E | S | 2 | C-04 | La isla de prueba carga; si falla, se ve un mensaje y un enlace alternativo |
| F2-15 | Módulo CMS en el shell (rutas de React Router montadas por F1-11): sitios, editor de páginas por bloques, autosave con `useFetcher` y conflicto `412` visible, vista previa y publicación | PF-030, PF-031, PF-033, PF-034 | E | L | 2 | F1-11, F2-02, F2-04, F2-05, F2-06 | E2E: editar → previsualizar → publicar → ver en el sitio |
| F2-16 | Tema y navegación básicos (tokens de la allowlist, contraste AA, enlaces seguros) y SEO básico (title, description, canonical) | PF-036, PF-038 | E | M | 2 | F2-02 | Un contraste insuficiente → 422 |

### Fase 3 — Administración de la organización (Sprint 2)

| ID | Ítem | PF | Par | Tamaño | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| F3-01 | Configurar la organización (nombre, zona IANA, locale) con `If-Match` | PF-020 | P | S | F1-01 | Una zona horaria inválida → 422; una revisión vieja → 412 |
| F3-02 | Suspensión y reactivación (platform admin): bloquea lo privado en menos de 60 s y conserva lo público según la política; evento de ciclo de vida | PF-020, PF-025 | P | M | F1-06 | Pasa el escenario de organización suspendida del spec |
| F3-03 | Invitaciones: crear (con MFA reciente), listar y revocar; token hasheado; vencimiento de 7 días como máximo; membresía `invited`; evento para el correo | PF-002 | P | M | F1-08, C-05 | No se duplican invitaciones pendientes (409); la respuesta nunca incluye el token |
| F3-04 | Aceptar o rechazar una invitación con correo verificado | PF-003 | P | M | F3-03 | Reusar el enlace → 409; vencida → 409 `invitation_expired` |
| F3-05 | Cambiar roles, suspender y revocar miembros con `If-Match` y MFA; el último owner está protegido; revoca sesiones en menos de 60 s; evento `platform.membership.changed.v1` | PF-008 | P | M | F3-04 | Quitar al último owner → 409 `last_owner` |
| F3-06 | Sesiones propias y de la organización: IP seudonimizada y revocación inmediata | PF-010 | P | M | F1-04 | La lista nunca expone tokens; una sesión revocada deja de funcionar de inmediato |
| F3-07 | Service accounts: crear (con MFA), secreto mostrado una vez o `private_key_jwt`, rotación con solapamiento y revocación; `POST /oauth/token` | PF-011 | P | L | F1-05 | Un equipo 2–4 obtiene un token con su audience exacta; uno revocado ya no puede |
| F3-08 | Kill switch: bloquea una organización o un client, revoca sesiones y clients; caché de la decisión de 60 s como máximo; runbook | PF-025 | P | M | F3-02, F3-07 | Tras activarlo, todo acceso privado se corta en menos de 60 s |
| F3-09 | Pantallas del shell: organización, miembros, invitaciones, sesiones y service accounts | PF-044 | E | L | F3-01, F3-03, F3-05, F3-06, F3-07 | E2E: invitar → aceptar → cambiar rol → revocar |
| F3-10 | Rutas públicas del gateway para la API de Participation: cuota por IP y evento, challenge anti-bot, `Idempotency-Key` obligatorio | PF-023 | P | M | F1-06, C-04 | Lo que el Equipo 3 necesita para su gate; sin clave → 400; exceso → 429 |
| F3-11 | Login de la PWA de check-in del Equipo 4 por nuestro BFF: origen y `return_to` en la allowlist; restricciones por evento y sede en los claims | PF-004, PF-023 | P | S | F1-03, C-10 | La PWA de prueba inicia sesión y recibe solo sus eventos asignados |

### Fase 4 — Dominios, medios y landing comercial (Sprint 3)

| ID | Ítem | PF | Par | Tamaño | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| F4-01 | Dominios: asociar, challenge DNS TXT o HTTP con protección contra SSRF, verificación; evento `platform.domain.activated.v1` | PF-021 | P | L | F2-08 | Un host que resuelve a una IP privada falla; un hostname repetido → 409 `hostname_taken` |
| F4-02 | TLS automático, reverificación periódica (takeover → `suspended`) y alertas de renovación | PF-021 | P | M | F4-01, C-11 | Un dominio que deja de apuntar queda `suspended` y no sirve contenido |
| F4-03 | Medios: URL firmada (MinIO), completion, verificación de magic bytes, ClamAV, estados y origen separado | PF-032 | E | L | F0-02 | Un archivo EICAR queda `quarantined` y nunca se sirve; un SVG se rechaza |
| F4-04 | Biblioteca de medios en el shell; texto alternativo obligatorio para imágenes públicas | PF-032 | E | M | F4-03 | No se puede publicar una imagen sin texto alternativo |
| F4-05 | Landing comercial (sitio `product`) | PF-040 | E | M | F2-12 | Pasa axe sin violaciones serias; LCP en móvil 4G menor a 2,5 s |
| F4-06 | Solicitud de demo: honeypot, challenge, rate limit, consentimiento y confirmación; datos guardados según el acuerdo C-13 | PF-040 | E | M | F4-05, C-13 | Un bot (honeypot lleno) se descarta; el evento interno no lleva datos personales |
| F4-07 | Demo reproducible: seed con un evento simple y una convocatoria (fixtures del contrato del Equipo 2), reset versionado, banner "Demo" | PF-041 | E | M | F2-09, F0-14 | El reset deja siempre el mismo estado; el banner aparece en todas las páginas |
| F4-08 | Accesibilidad: auditoría con axe del sitio y el shell, teclado, foco, lector de pantalla, reduced motion; correcciones | PF-045 | E | M | F2-12, F2-15 | 0 violaciones serias o críticas en los journeys críticos |

### Fase 5 — Operación y endurecimiento (Sprint 4, antes de producción)

| ID | Ítem | PF | Par | Tamaño | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| F5-01 | Dashboards, alertas y SLO: p95, errores, pool de base de datos, lag del outbox y de las proyecciones, DLQ, aciertos de caché | PF-052 | P | M | F0-10 | Cada servicio tiene dashboard y alertas; se publican los SLO del spec 7.3 |
| F5-02 | DLQ restringida y replay controlado con auditoría; ACL por topic; compatibilidad en el schema registry | PF-053 | P | M | F0-09 | Un replay no duplica efectos; un schema incompatible se rechaza |
| F5-03 | Backups PITR cifrados y simulacro de restauración con RPO y RTO medidos; runbook | PF-054 | P | M | C-11 | Evidencia del simulacro con RPO y RTO medidos |
| F5-04 | Prueba de carga con k6 a 3× el pico esperado del sitio público y del gateway | PF-052 | A | M | C-12 | Informe con p95 y errores dentro de los SLO |
| F5-05 | Consulta y export de la auditoría (el export exige scope y MFA) | PF-012 | P | M | F1-01 | El export sin MFA reciente → 403 |
| F5-06 | Restaurar versiones con historial y comparación | PF-035 | E | M | F2-05 | Restaurar crea una publicación nueva y el snapshot viejo no cambia |
| F5-07 | SEO completo: Open Graph, imagen, sitemap y robots | PF-036 | E | M | F2-16 | El sitemap lista solo rutas publicadas; la vista previa nunca se indexa |
| F5-08 | Temas avanzados (posterior al primer cliente) | PF-038 | E | M | F2-16 | Vista previa, publicación y rollback del tema |
| F5-09 | Firma de imágenes (cosign), promoción entre ambientes y rollback | PF-050 | P | M | F0-13, C-11 | Solo se despliegan imágenes firmadas; el rollback está probado |
| F5-10 | Secret manager real con rotación | PF-051 | P | M | C-11 | Rotar un secreto no exige redeploy manual |
| F5-11 | Runbooks por servicio y estado interno autenticado | PF-055 | A | S | F5-01 | Cada servicio tiene su runbook; el estado interno exige autenticación |

## 4. Acuerdos con otros equipos

No son desarrollo de otros equipos: son contratos que necesitamos cerrar para avanzar. Corresponden a la sección 13 del
spec.

| ID | Acuerdo | Con quién | Bloquea | Fecha límite | Spec 13 |
| --- | --- | --- | --- | --- | --- |
| C-01 | Broker de eventos | Equipos 1–4 | F0-09 | Mitad del Sprint 0 | #1 |
| C-02 | Formato del manifiesto de release y cómo se obtiene `manifest_ref` | Equipo 2 | F0-04, F2-09 | Fin del Sprint 0 | #2 |
| C-03 | Payload de `participation.availability.changed.v1` | Equipo 3 | F0-04, F2-09 | Fin del Sprint 0 | #3 |
| C-04 | Integración de la isla de registro y rutas públicas de Participation | Equipo 3 | F2-14, F3-10 | Inicio del Sprint 2 | #4 |
| C-05 | Correo de las invitaciones de plataforma | Equipo 4 | F3-03 | Inicio del Sprint 2 | #5 |
| C-06 | Rol `platform_admin` | Arquitectura | F1-02 | Fin del Sprint 0 | #7 |
| C-07 | Registrar en el catálogo las adiciones (spec 9.6), los códigos de error (9.7), los prefijos, el scope `events:read` y el envelope sin evento de negocio | Arquitectura y Equipo 2 | F0-03 | Mitad del Sprint 0 | #8, #10, #11 |
| C-08 | Montaje de los módulos de los equipos 2–4 en el shell | Equipos 2–4 | F1-11 | Inicio del Sprint 1 | #16 |
| C-09 | Diseño visual, tokens y versión de Tailwind | Integrante de frontend | F0-15 | Mitad del Sprint 0 | #15 |
| C-10 | Login de la PWA de check-in y restricciones por evento y sede | Equipo 4 | F3-11 | Inicio del Sprint 2 | #17 |
| C-11 | Proveedores: OIDC definitivo, CDN/WAF, correo, almacenamiento, KMS y hosting | IncubaUNAS | F4-02, F5-03, F5-09, F5-10 | Inicio del Sprint 3 | #12 |
| C-12 | Cifras de carga (usuarios simultáneos, visitas por minuto) | IncubaUNAS | F5-04 | Inicio del Sprint 3 | #14 |
| C-13 | Dónde y cómo se guardan los datos de quien solicita una demo | Equipo e IncubaUNAS | F4-06 | Inicio del Sprint 3 | #6 |
| C-14 | Mapeo de rol a scopes | Equipos 2–4 | F0-08 | Mitad del Sprint 0 | #9 |
| C-15 | Retención legal de datos | UNAS/IncubaUNAS | Producción | Antes de producción | #13 |
| C-16 | Aviso del cambio de Astro a React en el sitio público (ADR-0001) | Arquitectura y Equipo 3 | Nada: es un aviso | Inicio del Sprint 0 | #18 |

## 5. Riesgos

| Riesgo | Efecto | Mitigación |
| --- | --- | --- |
| El Equipo 2 no tiene listo el manifiesto de release (C-02) | Sin Gate público en el Sprint 1 | Acordar el JSON Schema en el Sprint 0 y trabajar con fixtures validados contra él |
| Somos la ruta crítica de los equipos 2–4 | Si se atrasan F0-08, F1-05 o F1-06, se atrasan todos | `authz` y los tokens internos van primero; se publica una versión temprana del paquete con tokens de prueba |
| Sprint 1 cargado (24 ítems entre los dos pares) | El Gate público se corre al Sprint 2 | F2-13 a F2-16 ya están en el Sprint 2; si hace falta, F1-11 también pasa |
| El broker no se decide a tiempo (C-01) | F0-09 se bloquea | El puerto `EventBus` y el adaptador en memoria permiten avanzar; el adaptador real entra en cuanto haya decisión |
| Diseño visual tardío (C-09) | Rehacer estilos, como en el primer intento | Tokens acordados en el Sprint 0, antes de F2-12 |
| Más JavaScript que con Astro: React hidrata la página entera | LCP o presupuesto de JavaScript fuera de objetivo en móvil | Pre-render de la landing, código dividido por ruta, isla diferida y presupuesto medido en CI desde F0-12 |
| Los mocks se quedan y pasan por reales, como lo simulado del primer intento | Una historia o un gate se da por hecho sin backend | `X-Mock` en cada respuesta, estado por operación en `docs/COBERTURA.md`, staging no arranca con mocks (F0-16) y la DoD exige `real` (spec 3.8) |
| React Router 8 es reciente (8.0 salió en 2026) | Cambios de API o errores entre versiones menores | Versión fijada en el lockfile, sin APIs `unstable_`, changelog revisado antes de actualizar y pruebas de rutas con `createRoutesStub` |

## 6. Cobertura de historias

Cada historia del backlog canónico del Equipo 1 y los ítems que la cubren:

| PF | Historia | Ítems |
| --- | --- | --- |
| PF-001 | Crear organización y su primer owner | F1-01, F1-02 |
| PF-002 | Invitar un miembro con roles | F3-03 |
| PF-003 | Aceptar o rechazar la invitación | F3-04 |
| PF-004 | Iniciar sesión con OIDC + PKCE | F1-03, F3-11 |
| PF-005 | Mantener y cerrar la sesión | F1-04 |
| PF-006 | Respuesta clara sin membresía o bloqueado | F1-07, F1-09 |
| PF-007 | Recuperar acceso o configurar MFA en el IdP | F1-08 |
| PF-008 | Cambiar roles, suspender o revocar | F3-05 |
| PF-009 | Cambiar de organización | F1-07 |
| PF-010 | Consultar y revocar sesiones | F3-06 |
| PF-011 | Service accounts | F3-07 |
| PF-012 | Consultar auditoría | F1-01, F5-05 |
| PF-020 | Configurar la organización | F3-01, F3-02 |
| PF-021 | Asociar y verificar un dominio | F4-01, F4-02 |
| PF-022 | Resolver host y slug | F2-08 |
| PF-023 | Gateway común | F1-05, F1-06, F1-12, F3-10, F3-11 |
| PF-024 | Librería de tenant y RBAC | F0-07, F0-08 |
| PF-025 | Kill switch | F3-02, F3-08 |
| PF-030 | Crear y configurar un sitio | F2-01, F2-02, F2-15 |
| PF-031 | Páginas con bloques tipados | F2-03, F2-04, F2-15 |
| PF-032 | Subir medios | F4-03, F4-04 |
| PF-033 | Previsualizar | F2-06, F2-15 |
| PF-034 | Publicar una versión inmutable | F2-05, F2-15 |
| PF-035 | Restaurar una versión | F5-06 |
| PF-036 | SEO y redes | F2-16, F5-07 |
| PF-037 | Catálogo, evento destacado y agenda | F2-09, F2-13 |
| PF-038 | Tema y navegación versionados | F0-15, F2-16, F5-08 |
| PF-040 | Landing comercial y solicitud de demo | F4-05, F4-06 |
| PF-041 | Demo reproducible | F0-14, F4-07 |
| PF-042 | Sitio, catálogo, detalle y programas | F2-07, F2-09, F2-10, F2-12 |
| PF-043 | Iniciar el registro desde la página del evento | F2-12, F2-14 |
| PF-044 | Shell administrativo | F1-10, F1-11, F3-09 |
| PF-045 | Accesible y responsive | F0-15, F4-08 |
| PF-046 | Contenido sin cruces de caché | F2-07, F2-11 |
| PF-050 | Plantilla de repositorio y pipeline | F0-01, F0-05, F0-13, F5-09 |
| PF-051 | Secretos y configuración | F0-02, F0-11, F5-10 |
| PF-052 | Métricas, logs y trazas | F0-10, F5-01, F5-04 |
| PF-053 | Broker, schemas, retry y DLQ | F0-04, F0-09, F5-02 |
| PF-054 | Backups y recuperación | F5-03 |
| PF-055 | Health y diagnóstico | F0-11, F5-11 |

## 7. Definition of Ready y Definition of Done

**Un ítem entra a un sprint (Ready)** solo si declara, como pide la arquitectura: scope y rol, precondiciones, estados
alternos, contrato (API o evento), datos que toca, criterios observables, pruebas negativas y telemetría. Además, sus
acuerdos `C-xx` están cerrados o tiene fixtures validados contra el contrato acordado.

**Un ítem está terminado (Done)** cuando cumple la Definition of Done del spec (7.7):

- Contrato actualizado y en verde.
- Toda conexión nueva pasa por una API con contrato.
- Están las pruebas que aplican, incluidas las negativas de autorización y tenant.
- Las migraciones son forward-only con RLS.
- Los comandos son idempotentes y los consumidores tienen inbox.
- La telemetría no lleva datos personales.
- Se verificó la accesibilidad si toca UI.
- `docs/COBERTURA.md` está al día.
- El PR está aprobado y `pnpm check` en verde.
