# ADR 0006 — Outbox, inbox y broker pendiente

**Estado:** aceptada, con una parte **abierta**

## Decisión

- Los eventos se escriben en una tabla `outbox` **en la misma transacción** que el cambio de negocio y se validan contra su JSON Schema antes de escribirse: un evento que viola el contrato revierte el comando.
- Un relay lee el outbox con `FOR UPDATE SKIP LOCKED`, publica con reintentos exponenciales con _jitter_ y manda a `dead` (DLQ) tras agotar los intentos. La entrega es al menos una vez.
- Los consumidores usan una tabla `inbox` única por `(consumidor, domain_event_id)` en la misma transacción que la proyección, descartan mensajes más viejos por `aggregate.version` y nunca activan una release incompleta.
- Los eventos no llevan datos personales (el gate de contratos lo comprueba).

## Abierto

El **broker** no está decidido (la arquitectura lo deja diferido). Hoy el relay publica al log y los consumidores se prueban con un bus en memoria. Cuando se elija, solo hay que escribir un adaptador de `EventPublisher` y otro de `EventSubscriber`; el contrato y el outbox no cambian.

## Supuestos con otros equipos

El formato del manifiesto de release (Equipo 2) y los campos de `participation.availability.changed.v1` (Equipo 3) son supuestos nuestros: `contracts/schemas/release-manifest.v1.json` y las pruebas de la proyección los documentan.
