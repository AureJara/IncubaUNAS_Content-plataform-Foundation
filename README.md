# IncubaUNAS — Content & Platform Foundation (Equipo 1)

Plataforma de eventos, congresos y convocatorias de IncubaUNAS. Este repositorio es el del **Equipo 1**: gateway con
sesión y tokens internos, organizaciones y membresías, CMS, sitio público y Admin shell. De los equipos 2–5 solo hay
contratos.

- Especificación: [`spec.md`](spec.md) (fuente de verdad) y [`backlog.md`](backlog.md) (orden del trabajo).
- Arquitectura de referencia: <https://github.com/juancxdev/event-platform-architecture>. Si el spec la contradice,
  manda la arquitectura.
- Qué está hecho y en qué estado responde cada operación: [`docs/COBERTURA.md`](docs/COBERTURA.md).

> **Estado: Sprint 0, solo backend y con las APIs en mock** (spec 3.8). Todas las operaciones responden, pero casi
> todas con el ejemplo del contrato y el header `X-Mock`. Un mock no es trabajo terminado. La UI todavía no existe.

## Estructura

| Carpeta                  | Qué contiene                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `contracts/`             | OpenAPI 3.1 (`auth`, `platform`, `cms`, `public`), ejemplos y schemas; `dist/` se genera                              |
| `packages/shared-kernel` | Reloj, UUID v7, errores de dominio y máquina de estados                                                               |
| `packages/http-kit`      | Registro de rutas por `operationId`, validación con el OpenAPI, mocks, idempotencia, Problem Details                  |
| `packages/authz`         | Verificación de tokens internos, roles y scopes; lo usan también los equipos 2–4 ([README](packages/authz/README.md)) |
| `packages/api-client`    | Cliente tipado generado desde los contratos                                                                           |
| `services/gateway`       | BFF: sesión de prueba en local, firma de tokens internos, JWKS y proxy                                                |
| `services/platform-api`  | Identidad, organizaciones, membresías, invitaciones, dominios y auditoría                                             |
| `services/content-api`   | Procesos `cms` y `public-read`                                                                                        |
| `tests/`                 | Pruebas de fronteras de capas y de integración de la cadena local                                                     |

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

Para levantar los servicios en local, copia `.env.example` a `.env` y arranca cada uno en su terminal:

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

Por el gateway, `GET http://localhost:8080/platform/v1/me` responde con la sesión de prueba (rol según `MOCK_ROLE`).
`GET /health/ready` de cada servicio lista el estado de sus operaciones: `example`, `memory` o `real`.

## Reglas

- El repositorio es público: ningún secreto, token ni dato personal en commits, fixtures, logs ni capturas.
- Todo se conecta mediante APIs con contrato (spec 3.2).
- Capas hexagonales; ESLint hace cumplir las fronteras (spec 3.4).
- Con `APP_ENV=staging` o `production`, un servicio con mocks no arranca (MOCK-06).
