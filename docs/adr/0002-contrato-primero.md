# ADR 0002 — Contrato primero

**Estado:** aceptada · **Origen:** gate de Sprint 0 del repositorio de arquitectura

## Decisión

Los OpenAPI 3.1, el AsyncAPI y los JSON Schemas de `contracts/` son la fuente de verdad y se escriben antes que el código.

- `http-kit` registra una ruta por operación del OpenAPI y **falla al arrancar** si falta un handler o sobra uno.
- `tools/lint-contracts.mjs` (Spectral + reglas propias) exige, entre otras cosas: `Idempotency-Key` en cada POST de comando, `If-Match` y `412` en cada PATCH, cuerpos con `additionalProperties: false`, ningún `organization_id` en cuerpos, `snake_case`, errores `application/problem+json`, ejemplos de evento válidos, ningún dato personal en los eventos y cobertura completa del catálogo.
- Las pruebas de integración validan **cada respuesta** contra el esquema de su operación.
- El sitio público y el panel generan sus tipos desde el OpenAPI (`openapi-typescript`).

## Consecuencias

El contrato ya detectó omisiones reales (códigos `304`, `409` y `422` sin declarar, una operación con seguridad inconsistente). A cambio, cada cambio de API toca dos lugares. Hemos añadido siete operaciones al catálogo y normalizado sus rutas; están registradas en `contracts/catalog.team1.json` para avisar a los demás equipos.
