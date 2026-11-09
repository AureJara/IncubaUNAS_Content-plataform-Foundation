# Reglas de trabajo — Equipo 1 (Content & Platform Foundation)

- La fuente de verdad es `spec.md`; el trabajo se ordena con `backlog.md`. `spec.md` no se sube al repositorio (está en
  `.gitignore`): si cambia su catálogo de rutas (9.2–9.6), se actualiza `contracts/catalog.json`. Si el spec contradice a la arquitectura
  (https://github.com/juancxdev/event-platform-architecture), manda la arquitectura.
- Solo se desarrolla el Equipo 1. De los equipos 2–5 solo hay contratos.
- Todo se conecta mediante APIs con contrato (spec 3.2). Contrato primero: se cambia `contracts/` y se corre
  `pnpm contracts:lint` y `pnpm contracts:build` antes del código.
- Mientras una operación no tenga caso de uso, responde con su mock (spec 3.8). Un mock nunca se reporta como terminado.
- Capas hexagonales y SOLID (spec 3.4); ESLint hace cumplir las fronteras.
- El repositorio es público: ningún secreto, token ni dato personal en commits, fixtures, logs ni capturas.
- Antes de cerrar un cambio: `pnpm check` en verde y `docs/COBERTURA.md` actualizado.
