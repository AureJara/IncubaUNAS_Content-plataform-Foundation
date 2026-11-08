# ADR-0001: Todo el frontend en React con React Router

- **Estado:** aceptada por el equipo (2026-11-07 y 2026-11-08). Pendiente de aviso al dueño de la arquitectura y al
  Equipo 3 (acuerdo C-16, spec 13 #18).
- **Spec:** secciones 2 y 3.7.

## Contexto

La arquitectura asigna Astro al sitio público y React al backoffice. El equipo prefiere una sola herramienta para los dos
frontends, para compartir componentes (`packages/ui`) y una sola forma de cargar datos.

## Decisión

- `web-public`: React Router 8 en modo framework, con SSR sobre Node y pre-render de la landing comercial.
- `admin-shell`: React Router 8 en modo datos (`createBrowserRouter`), como SPA estática servida por el gateway.
- Loaders y actions son la única capa de datos (sin TanStack Query).

## Consecuencias

- Más JavaScript en el sitio público que con Astro: presupuesto de 120 KB gzip medido en CI (spec 7.3).
- La CSP del sitio permite los scripts de hidratación por hash, no por nonce, porque el HTML se cachea en el CDN
  (SEC-13).
- React Router 8 exige Node ≥ 22.22.0 y React ≥ 19.2.7.
- La isla de registro del Equipo 3 no cambia de contrato (ya era React).

## Alternativas descartadas

- **Astro** (lo que pide la arquitectura): dos herramientas distintas en el equipo.
- **Next.js**: su caché propia (ISR y caché de datos) se superpone con la purga del CDN por surrogate key (PF-046).
