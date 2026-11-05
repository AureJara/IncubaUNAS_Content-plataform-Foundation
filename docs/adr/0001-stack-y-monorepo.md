# ADR 0001 — Stack y monorepo del Equipo 1

**Estado:** aceptada (2026-11-04) · **Decide:** el equipo

## Decisión

- Backend en **TypeScript sobre Node 24**, con **Fastify** como servidor HTTP y **PostgreSQL** (una base lógica por servicio).
- **Astro** para el sitio público y **React + Vite** para el panel.
- Un **monorepo pnpm** para todo lo del Equipo 1: servicios, apps y paquetes compartidos.
- **Keycloak** como proveedor OIDC de desarrollo y staging. La plataforma solo habla OIDC estándar, así que cambiar de proveedor es configuración.

## Por qué

Un solo lenguaje comparte tipos y validaciones entre servicios, Astro y React. El monorepo reduce la fricción de un equipo pequeño y permite publicar `tenancy` y los tokens de diseño a los demás equipos como paquetes. Fastify valida contra esquemas JSON, que es justo lo que produce el OpenAPI.

## Consecuencias

- Los paquetes internos exportan TypeScript sin compilar (`exports` apunta a `src/`) y se ejecutan con `tsx`/Vitest. Falta una compilación de producción por servicio (`tsup`).
- El hosting y el CDN siguen sin decidir; el diseño no depende de ellos.
