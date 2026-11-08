# IncubaUNAS — Content & Platform Foundation (Equipo 1)

Plataforma de eventos, congresos y convocatorias de IncubaUNAS. Este repositorio es el del **Equipo 1**: gateway con
sesión y tokens internos, organizaciones y membresías, CMS, sitio público y Admin shell. De los equipos 2–5 solo hay
contratos.

> **Estado: Sprint 0, solo backend y con las APIs en mock** (spec 3.8). Todas las operaciones responden, pero casi
> todas con el ejemplo del contrato y el header `X-Mock`. Un mock no es trabajo terminado. La UI todavía no existe.

## Documentación

| Documento                                                                              | Qué contiene                                                                                                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`spec.md`](spec.md)                                                                   | La especificación del Equipo 1: requisitos, arquitectura, reglas y catálogo de APIs. Es la fuente de verdad |
| [`backlog.md`](backlog.md)                                                             | El trabajo ordenado por sprints (F0–F5) y los acuerdos pendientes con otros equipos (C-xx)                  |
| [`docs/COBERTURA.md`](docs/COBERTURA.md)                                               | Qué está hecho, a medias o pendiente, y en qué estado responde cada operación                               |
| [`docs/adr/`](docs/adr/)                                                               | Decisiones de arquitectura. ADR-0001: todo el frontend con React y React Router                             |
| [`contracts/openapi/`](contracts/openapi/)                                             | Los contratos de las APIs (OpenAPI 3.1), con sus ejemplos en `contracts/examples/`                          |
| [`packages/authz/README.md`](packages/authz/README.md)                                 | Cómo verificar los tokens internos, claims, roles y scopes; pensado para los equipos 2–4                    |
| [`CLAUDE.md`](CLAUDE.md)                                                               | Reglas de trabajo del equipo                                                                                |
| [Arquitectura de referencia](https://github.com/juancxdev/event-platform-architecture) | La arquitectura de los 5 equipos. Si el spec la contradice, manda la arquitectura                           |

## Estructura

| Carpeta                  | Qué contiene                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `contracts/`             | OpenAPI 3.1 (`auth`, `platform`, `cms`, `public`), ejemplos y schemas; `dist/` se genera             |
| `packages/shared-kernel` | Reloj, UUID v7, errores de dominio y máquina de estados                                              |
| `packages/http-kit`      | Registro de rutas por `operationId`, validación con el OpenAPI, mocks, idempotencia, Problem Details |
| `packages/authz`         | Verificación de tokens internos, roles y scopes                                                      |
| `packages/api-client`    | Cliente tipado generado desde los contratos                                                          |
| `services/gateway`       | BFF: sesión de prueba en local, firma de tokens internos, JWKS y proxy                               |
| `services/platform-api`  | Identidad, organizaciones, membresías, invitaciones, dominios y auditoría                            |
| `services/content-api`   | Procesos `cms` y `public-read`                                                                       |
| `tests/`                 | Pruebas de fronteras de capas y de integración de la cadena local                                    |

## Requisitos

- Node 22.22 o más reciente (`.nvmrc`); ejecuta el TypeScript directamente, sin compilar.
- pnpm 12 (`packageManager` en `package.json`).

## Uso

```bash
pnpm install
```

```bash
pnpm check
```

`pnpm check` corre el lint de contratos, `contracts:check`, ESLint, Prettier, `tsc` y las pruebas. Debe quedar en verde
antes de integrar un cambio.

Si cambias un contrato, primero el contrato y después el código:

```bash
pnpm contracts:lint
```

```bash
pnpm contracts:build
```

## Levantar las APIs en local

Copia `.env.example` a `.env` y arranca cada servicio en su terminal:

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

| Servicio       | Puerto | Contrato        | Rutas                                                                                                                                            |
| -------------- | -----: | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gateway`      |   8080 | `auth.yaml`     | `/auth/*`, `/oauth/token`, `/.well-known/jwks.json`; reenvía `/platform/v1/*`, `/cms/v1/*`, `/public/v1/invitations/*` y las solicitudes de demo |
| `platform-api` |   8081 | `platform.yaml` | `/platform/v1/*`, aceptar o rechazar invitaciones y solicitudes de demo                                                                          |
| `cms`          |   8082 | `cms.yaml`      | `/cms/v1/*`                                                                                                                                      |
| `public-read`  |   8083 | `public.yaml`   | `/public/v1/sites/*`, `/public/v1/site-resolutions` y `/public/v1/previews/*`                                                                    |

Todos exponen `GET /health/live` y `GET /health/ready`; `ready` lista el estado de cada operación.

El navegador y el frontend hablan solo con el **gateway** (y con `public-read` para el sitio público). Llamar directo a
`platform-api` o al CMS sin token da 401: el token interno lo pone el gateway.

## Trabajar con los mocks

- **Sesión de prueba.** En local el gateway atiende con un usuario ficticio y el rol de `MOCK_ROLE` (por defecto
  `site_editor`). Cambia el rol en `.env` y reinicia el gateway para probar otros permisos. Los roles válidos están en
  `.env.example`.
- **`X-Mock`.** Toda respuesta que todavía no es real lleva `X-Mock: example` (el ejemplo del contrato) o
  `X-Mock: memory`.
- **Otro ejemplo.** `Prefer: example=<nombre>` elige otro ejemplo del contrato, por ejemplo un error; la respuesta trae
  `Preference-Applied`. Los nombres están en `contracts/examples/`.
- **Comandos.** Los `POST` de `/platform`, `/cms` y `/public` exigen `Idempotency-Key` (16 a 128 caracteres: letras, números, `-` o `_`; por ejemplo un UUID): con la misma clave y el mismo
  cuerpo se repite la respuesta; con otro cuerpo, 409. `PATCH` y `PUT` exigen `If-Match` con el ETag (sin él, 428).
- **Errores.** Siempre en Problem Details (`application/problem+json`) con `code` y `request_id`.
- **Tenant.** Sale del token: mandar `organization_id` en la query o en un header da 422.

Ejemplos, con el gateway levantado:

```bash
curl -i http://localhost:8080/platform/v1/me
```

```bash
curl -i -X POST http://localhost:8080/cms/v1/sites -H "Content-Type: application/json" -H "Idempotency-Key: demo-crear-sitio-0001" -d '{"slug":"congreso-demo","name":"Congreso Demo","kind":"demo","locale":"es-PE"}'
```

```bash
curl -i -X POST http://localhost:8080/cms/v1/sites -H "Content-Type: application/json" -H "Idempotency-Key: demo-crear-sitio-0002" -H "Prefer: example=slug_taken" -d '{"slug":"congreso-demo","name":"Congreso Demo","kind":"demo","locale":"es-PE"}'
```

El primero devuelve el usuario de la sesión de prueba, el segundo crea un sitio (201) y el tercero responde el error
`slug_taken` (409). Desde código, el cliente tipado `@incuba/api-client` hace las mismas llamadas.

## Reglas

- El repositorio es público: ningún secreto, token ni dato personal en commits, fixtures, logs ni capturas.
- Todo se conecta mediante APIs con contrato (spec 3.2). Contrato primero, después el código.
- Capas hexagonales; ESLint hace cumplir las fronteras (spec 3.4).
- Con `APP_ENV=staging` o `production`, un servicio con mocks no arranca (MOCK-06).
- Antes de integrar: `pnpm check` en verde y `docs/COBERTURA.md` al día.
