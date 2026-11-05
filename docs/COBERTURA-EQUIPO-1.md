# Cobertura del backlog del Equipo 1

Estado de las 40 historias de [`TEAM-1-CONTENT-PLATFORM.md`](https://github.com/juancxdev/event-platform-architecture/blob/main/backlogs/TEAM-1-CONTENT-PLATFORM.md) al 2026-11-04.

- **Hecha**: criterios de aceptación cubiertos y probados.
- **Parcial**: la parte central funciona y está probada; se indica lo que falta.
- **Pendiente**: sin implementar.

**Resumen: 17 hechas · 20 parciales · 3 pendientes.**

## PF-A — Organizaciones, identidad y acceso

| ID     | Estado  | Notas                                                                                                                       |
| ------ | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| PF-001 | Hecha   | Alta idempotente, slug único, owner activo, auditoría y evento.                                                             |
| PF-002 | Hecha   | Invitación de un uso, expirable (≤7 días), sin duplicados; el token solo viaja por correo. Entrega de correo sin reintento. |
| PF-003 | Hecha   | Exige identidad verificada y correo coincidente; replay rechazado.                                                          |
| PF-004 | Hecha   | PKCE, state, nonce y destinos en allowlist. **Verificado contra Keycloak real** (`e2e:oidc`).                               |
| PF-005 | Hecha   | Refresh rotado, reutilización revoca la sesión, vencimiento por inactividad y absoluto, tokens fuera de `localStorage`.     |
| PF-006 | Parcial | 401/403/404 coherentes y UI de "sin acceso". Falta auditar todas las denegaciones.                                          |
| PF-007 | Parcial | MFA reciente exigido en acciones críticas. Falta configurar Keycloak para emitir `amr` y enlazar la recuperación de cuenta. |
| PF-008 | Hecha   | If-Match, nunca deja sin owner (también por trigger de BD), cortes de sesión al suspender o revocar.                        |
| PF-009 | Hecha   | Solo membresías activas; sesión reemitida. La URL no refleja todavía la organización.                                       |
| PF-010 | Parcial | Lista y revoca sesiones propias y de miembros (admin). Falta la vista de administración de sesiones de otros.               |
| PF-011 | Parcial | Alta, rotación con solapamiento, revocación, scopes mínimos. Falta el endpoint que emite tokens de cliente.                 |
| PF-012 | Hecha   | Listado con filtros y paginación, append-only, sin datos personales. Exportación sensible pendiente.                        |

## PF-B — Tenant, dominios y gateway

| ID     | Estado    | Notas                                                                                                                |
| ------ | --------- | -------------------------------------------------------------------------------------------------------------------- |
| PF-020 | Hecha     | Edición con revisión optimista; suspender corta sesiones y archivar es terminal.                                     |
| PF-021 | Parcial   | Registro, desafío DNS/HTTP, verificación y estados. Faltan TLS automatizado, renovación y alertas.                   |
| PF-022 | Parcial   | `host → site_id` con IDs opacos. Falta `site_id → slug` para que Astro sirva varios sitios (hoy uno por despliegue). |
| PF-023 | Pendiente | No hay gateway. Cada servicio aplica cuota por IP, CORS y request id; falta WAF, validación JWT central y exchange.  |
| PF-024 | Hecha     | `@incubaunas/tenancy` (roles, scopes, restricciones, MFA reciente) y `withTenant` para RLS.                          |
| PF-025 | Parcial   | Suspender organización y revocar cuentas de servicio cortan el acceso. Falta el _kill switch_ de clients y runbook.  |

## PF-C — CMS y medios

| ID     | Estado  | Notas                                                                                                                                                                                                                                             |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-030 | Hecha   | Sitios `product`/`demo`/`client` con slug global único.                                                                                                                                                                                           |
| PF-031 | Hecha   | Un JSON Schema por bloque, HTML rechazado, errores por pointer, ETag. Autosave de la UI pendiente.                                                                                                                                                |
| PF-032 | Parcial | Subida firmada, tipo/tamaño/hash, `alt` obligatorio, estados hasta `ready`. Faltan almacenamiento y escáner reales.                                                                                                                               |
| PF-033 | Hecha   | Token corto de un solo uso, `no-store`, `noindex`.                                                                                                                                                                                                |
| PF-034 | Hecha   | Snapshot inmutable con hash, idempotente, evento por outbox. La purga real del CDN depende de su elección.                                                                                                                                        |
| PF-035 | Hecha   | Restaurar crea una publicación nueva. Comparación e historial en la UI pendientes.                                                                                                                                                                |
| PF-036 | Parcial | Título, descripción, canonical, OG y robots por página. Faltan `sitemap.xml`, `robots.txt` y imagen OG.                                                                                                                                           |
| PF-037 | Parcial | Bloques de catálogo, evento destacado y agenda sobre la proyección. El formato del manifiesto es un **supuesto** del Equipo 2.                                                                                                                    |
| PF-038 | Parcial | Tema con contraste AA y navegación sin enlaces inseguros. Con el diseño del equipo de frontend solo se aplican `color_primary` y `radius`; el resto de la paleta es fija (ADR 0007). Falta versionar, previsualizar y revertir tema y navegación. |

## PF-D — Frontends públicos y Admin shell

| ID     | Estado  | Notas                                                                                                                                                                                                                         |
| ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-040 | Parcial | Inicio con el diseño del equipo de frontend y eventos reales; `/guia` sale del CMS. Faltan el formulario de leads, anti-spam y consentimiento.                                                                                |
| PF-041 | Parcial | Datos de demo reproducibles y sin PII (`seed:demo`). Faltan el reinicio versionado y el banner de demostración.                                                                                                               |
| PF-042 | Hecha   | SSR sobre la proyección, 404 y cancelado, zona horaria del evento, sin llamadas transaccionales en un cache hit.                                                                                                              |
| PF-043 | Parcial | Espacio estable para la isla del Equipo 3, CSP y _fallback_. Falta analytics con consentimiento.                                                                                                                              |
| PF-044 | Parcial | Login, organización activa, navegación por permiso, estados carga/vacío/error/prohibido, logout. Faltan _breadcrumbs_ y el módulo de CMS (requiere el gateway).                                                               |
| PF-045 | Parcial | Semántica, foco, teclado, `aria-live`, contraste y _reduced motion_. Falta una auditoría WCAG AA con herramienta; las páginas portadas del diseño (`/nosotros`, `/programas`, `/portafolio`, `/convocar`) no se han auditado. |
| PF-046 | Hecha   | Clave de caché, `ETag`/`304`, `Surrogate-Key`, sin cookies ni vista previa en respuestas públicas.                                                                                                                            |

## PF-E — Plataforma operable

| ID     | Estado    | Notas                                                                                                                                              |
| ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-050 | Parcial   | CI con lint, formato, tipos, contratos, pruebas, build, prueba de humo del sitio compilado y auditoría. Faltan SBOM, firma, imágenes y despliegue. |
| PF-051 | Parcial   | Configuración tipada que falla al arrancar. Falta el secret manager.                                                                               |
| PF-052 | Pendiente | Logs estructurados con redacción de secretos e ID de petición. Faltan OpenTelemetry, dashboards y SLO.                                             |
| PF-053 | Parcial   | Outbox, inbox idempotente, reintentos con _backoff_, DLQ y _replay_ en código. Falta el broker y el schema registry.                               |
| PF-054 | Pendiente | Sin backups ni _restore drill_ (depende del hosting).                                                                                              |
| PF-055 | Parcial   | `/health` en el sitio público. Faltan _readiness_ y _drain_ en las APIs.                                                                           |

## Supuestos pendientes con otros equipos

1. **Equipo 2** — formato del manifiesto referenciado por `configuration.event.release_published.v1` y cómo se calcula `manifest_hash` (`contracts/schemas/release-manifest.v1.json` es nuestro supuesto).
2. **Equipo 3** — campos de `participation.availability.changed.v1`.
3. **Todos** — hemos añadido siete operaciones al catálogo (ver `contracts/catalog.team1.json`, sección `additions`) y normalizado las rutas bajo `/platform/v1`, `/cms/v1` y `/public/v1`.
