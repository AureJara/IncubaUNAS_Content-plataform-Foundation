# Guía para trabajar en este repositorio

Equipo 1 (Content & Platform Foundation) de la plataforma de eventos de IncubaUNAS. Arquitectura de referencia: https://github.com/juancxdev/event-platform-architecture (solo documentación; léela con `gh api`, no la clones).

## Reglas

- **El repositorio es público.** Nunca commitear secretos, claves ni datos personales. Los valores locales van en `.env` (ignorado) y `.env.example` solo lleva valores de desarrollo.
- **Contrato primero.** Cambia el OpenAPI/AsyncAPI/JSON Schema de `contracts/` antes que el código y corre `pnpm contracts:lint`. Las rutas se generan desde el OpenAPI: un handler sin operación (o al revés) impide arrancar.
- **El tenant sale del token o de la sesión**, nunca del cuerpo, los headers ni la ruta. Todo acceso a tablas de tenant pasa por `withTenant`; las tablas nuevas con `organization_id` necesitan RLS forzada, política e índice con el tenant primero (hay una prueba que lo exige).
- **Capas (SOLID/DIP):** `domain/` no importa nada de afuera; `application/` depende de puertos (`ports.ts`), no de `pg` ni de Fastify. ESLint lo hace cumplir. La raíz de composición es `app.ts` (+ `main.ts`).
- **Comandos con efecto** llevan `Idempotency-Key`; las ediciones, `If-Match`; los eventos salen por outbox en la misma transacción y se consumen con inbox.
- **Migraciones forward-only.** No se edita una migración aplicada. Mientras el esquema no esté en producción se puede reiniciar la base local con `docker compose down -v` y editar `0001_init.sql`.
- **Pruebas:** cada cambio de comportamiento lleva prueba. Las de integración usan PostgreSQL real (`pnpm db:up`) y validan cada respuesta contra el OpenAPI.

## Comandos

```bash
pnpm check                      # lint + tipos + contratos + pruebas + prueba de humo del sitio
pnpm contracts:lint             # gate de contratos
pnpm test:smoke                 # compila web-public y lo prueba contra una Content API simulada
pnpm db:up                      # PostgreSQL local (roles migrator y app por servicio)
pnpm --filter <paquete> test    # pruebas de un paquete
pnpm format                     # Prettier
```

## Trampas conocidas

- `pnpm token` es un comando propio de pnpm: los scripts se llaman distinto (`mint-token`).
- Los scripts de Node imprimen `\r\n` en Windows: usa `tr -d '\r\n'` al capturar una salida en una variable de shell.
- `.env` se carga con `--env-file`; las pruebas lo leen vía `tools/vitest-env.ts`.
- Las pruebas que adelantan el reloj (`OffsetClock`) usan tokens de larga vigencia a propósito.
- El broker de eventos **no está decidido**: los relays publican al log. Los consumidores se prueban con `InMemoryEventBus`.
- **Sitio público (`apps/web-public`)**: el diseño es del equipo de frontend y se mantiene **idéntico a su build** (Tailwind **3** por PostCSS con su `tailwind.config.mjs`; referencia en `docs/diseno/`, decisión en el ADR 0007). No migres a Tailwind 4 sin avisarles: cambia cosas que hoy no cambian (`p-4.5` y `shadow-xs` pasan a aplicar, `leading-*` gana a `text-*`, otra escala de sombras).
- La CSP solo admite recursos propios: nada de Google Fonts, `lh3.googleusercontent.com`, scripts ni manejadores `on*` en línea. Vite tiene `assetsInlineLimit: 0` porque inlinar un script o una fuente `data:` rompe el menú móvil bajo esa CSP. `pnpm test:smoke` (compila y prueba el sitio real) lo vigila.
- En `global.css` la regla de los iconos va **sin capa y después de las utilidades**, como en el CSS de ellos: todos los iconos miden 24 px sea cual sea su `text-*`. En componentes nuevos usa `!text-base` (importancia) si quieres otro tamaño. Los colores `primary` salen de variables RGB (`--brand-*-rgb`) para que `bg-primary/10` siga funcionando con el color del sitio.
- Los archivos que llegan del equipo de frontend vienen con CRLF; normalízalos a LF antes de editarlos con scripts (un `replace` con `\n` no coincide con `\r\n`).
- El inicio (`/`) lo sirve `index.astro`, no el CMS; la página `/` del CMS queda tapada. Las demás rutas del CMS sí se sirven (`/guia` en el demo).

## Mapa

- `contracts/` — OpenAPI, AsyncAPI, schemas de eventos, `catalog.team1.json` (qué operaciones del catálogo cubrimos y cuáles añadimos).
- `packages/` — `shared-kernel`, `tenancy`, `db`, `events`, `http-kit`, `service-kit`.
- `services/platform-api`, `services/content-api` — hexagonal: `domain/`, `application/`, `infrastructure/`, `interfaces/http/`.
- `apps/web-public` (Astro), `apps/admin-shell` (React + Vite).
- `docs/adr/` — decisiones; `docs/COBERTURA-EQUIPO-1.md` — estado por historia.
