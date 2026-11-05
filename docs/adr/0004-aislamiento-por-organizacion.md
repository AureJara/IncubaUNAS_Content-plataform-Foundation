# ADR 0004 — Aislamiento por organización con RLS

**Estado:** aceptada · **Origen:** AD-12 del repositorio de arquitectura

## Decisión

- Toda tabla de datos de tenant lleva `organization_id`, `ENABLE` y `FORCE ROW LEVEL SECURITY` y una política `organization_id = app_current_organization()`.
- Cada servicio tiene dos roles: `<svc>_migrator` (dueño del esquema) y `<svc>_app` (`NOSUPERUSER`, `NOBYPASSRLS`). La aplicación solo usa el segundo.
- El tenant se fija por transacción con `set_config('app.organization_id', $1, true)` (equivale a `SET LOCAL`): no sobrevive a la conexión.
- El tenant viene del JWT o de la sesión validados. Un cuerpo que lo traiga se rechaza.
- Una organización ajena responde **404**, igual que una inexistente.

## Excepciones documentadas (sin RLS)

`users` e `identities` (directorio global de identidad), `sessions` y `login_attempts` (infraestructura de autenticación, siempre consultadas por id + secreto), `host_routes` y `public_*` (proyecciones públicas con datos ya publicados), `bootstrap_requests`, `outbox` e `inbox`.

## Verificación

`test/db/isolation.int.test.ts` prueba, contra PostgreSQL real y con una sola conexión reciclada, que un tenant no ve ni modifica a otro, que sin tenant no se ve nada, que el tenant no se filtra a la siguiente transacción y que toda tabla con `organization_id` fuera de la lista de excepciones tiene RLS, política e índice con el tenant primero.

## Invariante extra

Un trigger diferido garantiza que una organización activa nunca se queda sin `org_owner` activo, incluso ante carreras entre peticiones.
