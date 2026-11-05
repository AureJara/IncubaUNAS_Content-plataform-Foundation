# ADR 0005 — BFF con OIDC y sesiones del lado del servidor

**Estado:** aceptada · **Origen:** AUTH-AND-AUTHORIZATION-CONTRACT.md

## Decisión

- El navegador nunca ve tokens. La Platform API actúa como BFF: Authorization Code + **PKCE (S256)** con `state` y `nonce` guardados en el servidor (el intento va ligado a una cookie `HttpOnly`) y consumidos una sola vez.
- La sesión es una cookie `__Host-session` (`HttpOnly`, `Secure`, `SameSite=Lax`) con `id.secreto`; en la base solo se guarda el hash del secreto.
- **Refresh con rotación**: cada refresh cambia el secreto. Reutilizar el anterior revoca la sesión entera; peticiones en vuelo se toleran 30 s.
- Vencimiento por inactividad (8 h) y absoluto (30 d). Suspender una organización o a un miembro corta las sesiones afectadas.
- **CSRF** por doble envío: la cookie `__Host-csrf` es legible y el servidor compara el header con `HMAC(sessionId)`.
- Los permisos se leen de la base en cada petición, no de la sesión: suspender surte efecto de inmediato.
- `return_to` se valida contra una lista de **orígenes** permitidos.

## Consecuencias

- Verificado contra Keycloak real (`pnpm --filter @incubaunas/platform-api e2e:oidc`).
- Los servicios que no son Platform (Content) autentican con un **JWT interno** emitido por el gateway. El intercambio sesión → JWT y el gateway no están construidos todavía (PF-023): hoy Content solo acepta tokens de máquina, y por eso el módulo de CMS del panel no está conectado.
- Para exigir MFA hay que configurar Keycloak para emitir `amr`; sin ello las acciones que exigen MFA siempre se rechazan.
