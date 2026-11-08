// Generado por `pnpm contracts:build` desde contracts/dist/auth.json. No editar a mano.

export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health de vida */
        get: operations["getHealthLive"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health de disponibilidad */
        get: operations["getHealthReady"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Iniciar el login OIDC
         * @description Crea `state`, `nonce` y el verificador PKCE del lado del servidor y redirige al IdP. Un `return_to` fuera de la allowlist exacta lleva al inicio (RN-12).
         */
        get: operations["startLogin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Volver del IdP y crear la sesión
         * @description Valida `state`, `nonce`, PKCE, issuer y audience (PF-004).
         */
        get: operations["completeLogin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotar la sesión
         * @description Cada refresh rota el ID; reutilizar uno rotado revoca la familia (RN-09).
         */
        post: operations["refreshSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cerrar la sesión
         * @description Revoca la sesión y limpia la cookie aunque falle el logout federado. Idempotente.
         */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cerrar todas las sesiones del usuario */
        post: operations["logoutAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/jwks.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Claves públicas de los tokens internos */
        get: operations["getJwks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Token de una service account
         * @description `client_credentials` con secreto o con `private_key_jwt` (PF-011). La audience es exacta. Los errores siguen RFC 6749, no Problem Details.
         */
        post: operations["issueServiceToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Jwk: {
            /** @constant */
            kty: "EC";
            /** @constant */
            crv: "P-256";
            kid: string;
            /** @constant */
            use: "sig";
            /** @constant */
            alg: "ES256";
            x: string;
            y: string;
        };
        Jwks: {
            keys: components["schemas"]["Jwk"][];
        };
        TokenRequest: {
            /** @constant */
            grant_type: "client_credentials";
            client_id: string;
            client_secret?: string;
            /** @constant */
            client_assertion_type?: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
            client_assertion?: string;
            scope?: string;
            audience: string;
        };
        TokenResponse: {
            access_token: string;
            /** @constant */
            token_type: "Bearer";
            expires_in: number;
            scope: string;
        };
        OAuthError: {
            /** @enum {string} */
            error: "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client" | "unsupported_grant_type" | "invalid_scope";
            error_description?: string;
        };
        HealthLive: {
            /** @constant */
            status: "ok";
        };
        HealthReady: {
            /** @enum {string} */
            status: "ready" | "not_ready";
            /** @enum {string} */
            environment: "local" | "ci" | "staging" | "production";
            /** @description Estado de cada dependencia. */
            checks: {
                [key: string]: "ok" | "failing" | "not_configured";
            };
            /** @description Estado de cada operación del contrato (MOCK-04). */
            operations: {
                [key: string]: "example" | "memory" | "real";
            };
        };
        ProblemError: {
            /** @description JSON Pointer del campo con error. */
            pointer: string;
            code?: string;
            detail: string;
        };
        Problem: {
            /** Format: uri */
            type: string;
            title: string;
            status: number;
            /** @description Código estable (spec 9.7). */
            code: string;
            detail?: string;
            request_id: string;
            errors?: components["schemas"]["ProblemError"][];
        };
    };
    responses: {
        /** @description El proceso está vivo. */
        HealthLive: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["HealthLive"];
            };
        };
        /** @description Estado de las dependencias y de cada operación. */
        HealthReady: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["HealthReady"];
            };
        };
        /** @description Alguna dependencia falla. */
        HealthNotReady: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["HealthReady"];
            };
        };
        /** @description Se superó el límite de solicitudes. */
        TooManyRequests: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                "Retry-After": components["headers"]["RetryAfter"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Parámetros o headers inválidos. */
        BadRequest: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Sin sesión o con un token inválido. */
        Unauthorized: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Falta un scope, un rol o MFA reciente. */
        Forbidden: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
        RequestId: string;
    };
    requestBodies: never;
    headers: {
        /** @description Las respuestas privadas no se cachean. */
        NoStore: "no-store";
        /** @description Identificador del request (el recibido si era válido, o uno nuevo). */
        RequestId: string;
        /** @description Segundos que hay que esperar antes de reintentar. */
        RetryAfter: number;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getHealthLive: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["HealthLive"];
        };
    };
    getHealthReady: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["HealthReady"];
            503: components["responses"]["HealthNotReady"];
        };
    };
    startLogin: {
        parameters: {
            query?: {
                return_to?: string;
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirección al IdP. */
            302: {
                headers: {
                    /**
                     * @description URL de autorización del IdP.
                     * @example http://localhost:8180/realms/incubaunas/protocol/openid-connect/auth?client_id=gateway&response_type=code&state=example-state
                     */
                    Location?: string;
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeLogin: {
        parameters: {
            query: {
                code: string;
                state: string;
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sesión creada; redirige al destino validado. */
            302: {
                headers: {
                    /**
                     * @description Destino de la allowlist.
                     * @example /admin/
                     */
                    Location?: string;
                    /** @description Cookie de sesión `__Host-sid` (HttpOnly; Secure; SameSite=Lax). */
                    "Set-Cookie"?: string;
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
        };
    };
    refreshSession: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cookie nueva. */
            204: {
                headers: {
                    /** @description Cookie de sesión rotada. */
                    "Set-Cookie"?: string;
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sesión cerrada. */
            204: {
                headers: {
                    /** @description Cookie vencida. */
                    "Set-Cookie"?: string;
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
        };
    };
    logoutAll: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Todas las familias revocadas. */
            204: {
                headers: {
                    /** @description Cookie vencida. */
                    "Set-Cookie"?: string;
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getJwks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JWKS con la clave vigente y la anterior durante la rotación. */
            200: {
                headers: {
                    /**
                     * @description Las claves se cachean poco tiempo.
                     * @example public, max-age=300
                     */
                    "Cache-Control"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Jwks"];
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    issueServiceToken: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": components["schemas"]["TokenRequest"];
            };
        };
        responses: {
            /** @description Token interno con TTL corto. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenResponse"];
                };
            };
            /** @description Solicitud inválida. */
            400: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthError"];
                };
            };
            /** @description Cliente inválido, vencido o revocado. */
            401: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthError"];
                };
            };
        };
    };
}
