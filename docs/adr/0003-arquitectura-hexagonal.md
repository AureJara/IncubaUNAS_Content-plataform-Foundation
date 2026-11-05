# ADR 0003 — Arquitectura hexagonal y principios SOLID

**Estado:** aceptada

## Decisión

Cada servicio tiene cuatro capas con una sola dirección de dependencia:

```
interfaces/http  →  application  →  domain
infrastructure   →  application (implementa sus puertos)
```

- **`domain/`**: reglas de negocio puras (máquinas de estado, invariantes, validaciones). No importa nada de afuera.
- **`application/`**: casos de uso que dependen de **puertos** (`ports.ts`): repositorios, reloj, generador de IDs, cifrado de datos personales, notificador, proveedor OIDC.
- **`infrastructure/`**: adaptadores (PostgreSQL, SMTP, `openid-client`, DNS).
- **`app.ts`**: raíz de composición; es el único sitio que conoce implementaciones concretas.

## Cómo aplica SOLID

| Principio | En este repo                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| S         | Un servicio de aplicación por agregado; el handler HTTP solo traduce; el repositorio solo persiste.                   |
| O         | Roles y scopes son datos (`ROLE_SCOPES`), los bloques del CMS son un registro de esquemas: añadir uno no toca lógica. |
| L         | Cada puerto tiene un adaptador real y uno de pruebas intercambiables (reloj, bus, storage, escáner, IdP).             |
| I         | Puertos pequeños y específicos (`OutboxWriter`, `InboxStore`, `ObjectStorage`, `MalwareScanner`…).                    |
| D         | ESLint prohíbe que `domain/` y `application/` importen `pg`, Fastify o `infrastructure/` (`eslint.config.js`).        |

## Consecuencias

Más archivos y algo de _boilerplate_ a cambio de pruebas rápidas y de poder cambiar proveedores (broker, storage, IdP) sin tocar las reglas de negocio.
