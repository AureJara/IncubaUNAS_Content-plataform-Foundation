// Generado por `pnpm contracts:build` desde contracts/dist/platform.json. No editar a mano.

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
    "/platform/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Identidad, organización activa, roles y capabilities */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/me/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Permisos efectivos y restricciones */
        get: operations["getMyCapabilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/me/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sesiones propias, enmascaradas */
        get: operations["listMySessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/me/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revocar una sesión propia (o de un miembro, si es admin) */
        delete: operations["revokeSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/me/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Membresías activas del usuario */
        get: operations["listMyOrganizations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/session-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cambiar la organización activa de la sesión
         * @description Solo se acepta si el usuario tiene una membresía activa en esa organización (spec 9.3).
         */
        post: operations["switchSessionContext"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Catálogo de roles y sus scopes */
        get: operations["listRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Alta de una organización con su primer owner */
        post: operations["createOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Configuración de la organización */
        get: operations["getOrganization"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Configurar la organización */
        patch: operations["updateOrganization"];
        trace?: never;
    };
    "/platform/v1/organizations/{id}/suspensions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Suspender una organización y sus sesiones */
        post: operations["suspendOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations/{id}/reactivations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Volver de suspended a active */
        post: operations["reactivateOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations/{id}/memberships": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Miembros, roles y estado */
        get: operations["listMemberships"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/memberships/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Cambiar roles, suspender o revocar un miembro */
        patch: operations["updateMembership"];
        trace?: never;
    };
    "/platform/v1/organizations/{id}/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Invitaciones de la organización */
        get: operations["listInvitations"];
        put?: never;
        /** Invitar a una persona */
        post: operations["createInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/invitations/{id}/revocations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revocar una invitación pendiente */
        post: operations["revokeInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/invitations/{token}/acceptance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Aceptar una invitación con la sesión OIDC */
        post: operations["acceptInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/invitations/{token}/declination": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rechazar una invitación */
        post: operations["declineInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations/{id}/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sesiones de los miembros */
        get: operations["listOrganizationSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations/{id}/service-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Service accounts de la organización */
        get: operations["listServiceAccounts"];
        put?: never;
        /** Crear una service account */
        post: operations["createServiceAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/service-accounts/{id}/rotations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotar la credencial con solapamiento */
        post: operations["rotateServiceAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/service-accounts/{id}/revocations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revocar una service account de inmediato */
        post: operations["revokeServiceAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/sites/{id}/domains": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Dominios del sitio */
        get: operations["listDomains"];
        put?: never;
        /** Asociar un dominio propio a un sitio */
        post: operations["createDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/domains/{id}/verifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verificar el challenge del dominio */
        post: operations["verifyDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/platform/v1/organizations/{id}/audit-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar la auditoría */
        get: operations["listAuditEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/sites/{slug}/leads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Solicitud de demo
         * @description Anti-spam con honeypot (`website` vacío), challenge y rate limit. Dónde se guardan los datos lo fija el acuerdo C-13 (spec 13 #6); el evento interno no lleva datos personales.
         */
        post: operations["createLead"];
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
        /** @enum {string} */
        OrganizationState: "provisioning" | "active" | "suspended" | "archived";
        /** @enum {string} */
        MembershipState: "invited" | "active" | "suspended" | "revoked" | "expired";
        /** @enum {string} */
        InvitationState: "pending" | "accepted" | "declined" | "expired" | "revoked";
        /** @enum {string} */
        DomainState: "pending" | "verifying" | "active" | "failed" | "suspended" | "released";
        /** @description Zona IANA. */
        Timezone: string;
        Me: {
            user_id: components["schemas"]["Uuid"];
            display_name: string;
            active_organization: {
                id: components["schemas"]["Uuid"];
                slug: components["schemas"]["Slug"];
                display_name: string;
            } | null;
            membership_id: components["schemas"]["Uuid"] | null;
            roles: components["schemas"]["Role"][];
            capabilities: components["schemas"]["Scope"][];
            amr: string[];
            auth_time: components["schemas"]["Timestamp"];
        };
        Capabilities: {
            organization_id: components["schemas"]["Uuid"];
            roles: components["schemas"]["Role"][];
            scopes: components["schemas"]["Scope"][];
            restrictions: {
                /** @enum {string} */
                type: "event" | "venue";
                id: components["schemas"]["Uuid"];
            }[];
        };
        Session: {
            id: components["schemas"]["Uuid"];
            user_id: components["schemas"]["Uuid"];
            /** @enum {string} */
            state: "active" | "revoked" | "expired";
            current: boolean;
            /** @description IP seudonimizada. */
            ip_hint?: string;
            user_agent_family?: string;
            created_at: components["schemas"]["Timestamp"];
            last_seen_at: components["schemas"]["Timestamp"];
            expires_at: components["schemas"]["Timestamp"];
        };
        SessionCollection: {
            items: components["schemas"]["Session"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        MyOrganization: {
            organization_id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            display_name: string;
            membership_id: components["schemas"]["Uuid"];
            roles: components["schemas"]["Role"][];
            state: components["schemas"]["MembershipState"];
        };
        MyOrganizationCollection: {
            items: components["schemas"]["MyOrganization"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        SessionContextRequest: {
            organization_id: components["schemas"]["Uuid"];
        };
        SessionContext: {
            organization_id: components["schemas"]["Uuid"];
            membership_id: components["schemas"]["Uuid"];
            roles: components["schemas"]["Role"][];
            scopes: components["schemas"]["Scope"][];
        };
        RoleDefinition: {
            role: components["schemas"]["Role"];
            description: string;
            scopes: components["schemas"]["Scope"][];
        };
        RoleCollection: {
            items: components["schemas"]["RoleDefinition"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        Organization: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            legal_name: string;
            display_name: string;
            timezone: components["schemas"]["Timezone"];
            locale: components["schemas"]["Locale"];
            state: components["schemas"]["OrganizationState"];
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        OrganizationCreate: {
            slug: components["schemas"]["Slug"];
            legal_name: string;
            display_name: string;
            timezone: components["schemas"]["Timezone"];
            locale: components["schemas"]["Locale"];
            owner_identity: {
                /** Format: uri */
                issuer: string;
                subject: string;
            };
        };
        OrganizationPatch: {
            legal_name?: string;
            display_name?: string;
            timezone?: components["schemas"]["Timezone"];
            locale?: components["schemas"]["Locale"];
        };
        Membership: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            user_id: components["schemas"]["Uuid"];
            display_name: string;
            roles: components["schemas"]["Role"][];
            state: components["schemas"]["MembershipState"];
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        MembershipCollection: {
            items: components["schemas"]["Membership"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        MembershipPatch: {
            roles?: components["schemas"]["Role"][];
            /** @enum {string} */
            state?: "active" | "suspended" | "revoked";
        };
        InvitationCreate: {
            /** Format: email */
            email: string;
            roles: components["schemas"]["Role"][];
            /** @description Como máximo 7 días después de crearla. */
            expires_at?: components["schemas"]["Timestamp"];
        };
        Invitation: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            membership_id: components["schemas"]["Uuid"];
            /** @description Correo enmascarado. */
            email_hint: string;
            roles: components["schemas"]["Role"][];
            state: components["schemas"]["InvitationState"];
            expires_at: components["schemas"]["Timestamp"];
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        InvitationCollection: {
            items: components["schemas"]["Invitation"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        InvitationOutcome: {
            invitation_id: components["schemas"]["Uuid"];
            state: components["schemas"]["InvitationState"];
        };
        ServiceAccount: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            name: string;
            client_id: string;
            /** @enum {string} */
            auth_method: "client_secret" | "private_key_jwt";
            scopes: components["schemas"]["Scope"][];
            audiences: string[];
            /** @enum {string} */
            state: "active" | "revoked" | "expired";
            expires_at: components["schemas"]["Timestamp"];
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        ServiceAccountCreate: {
            name: string;
            /** @enum {string} */
            auth_method: "client_secret" | "private_key_jwt";
            scopes: components["schemas"]["Scope"][];
            audiences: string[];
            expires_at: components["schemas"]["Timestamp"];
            /** @description Clave pública si `auth_method` es `private_key_jwt`. */
            public_key_jwk?: Record<string, never>;
        };
        ServiceAccountCreated: {
            service_account: components["schemas"]["ServiceAccount"];
            /** @description Solo con `client_secret`; se muestra una vez y se guarda como hash. */
            client_secret?: string;
        };
        ServiceAccountCollection: {
            items: components["schemas"]["ServiceAccount"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        RotationRequest: {
            expires_at: components["schemas"]["Timestamp"];
            overlap_seconds?: number;
            public_key_jwk?: Record<string, never>;
        };
        Rotation: {
            credential_id: components["schemas"]["Uuid"];
            client_secret?: string;
            expires_at: components["schemas"]["Timestamp"];
            previous_expires_at: components["schemas"]["Timestamp"];
        };
        /** Format: hostname */
        Hostname: string;
        DomainCreate: {
            hostname: components["schemas"]["Hostname"];
        };
        Domain: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            site_id: components["schemas"]["Uuid"];
            hostname: components["schemas"]["Hostname"];
            primary: boolean;
            state: components["schemas"]["DomainState"];
            verification?: {
                /** @enum {string} */
                method: "dns_txt" | "http";
                record_name: string;
                record_value: string;
            };
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        DomainCollection: {
            items: components["schemas"]["Domain"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        AuditEvent: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            occurred_at: components["schemas"]["Timestamp"];
            actor: components["schemas"]["Actor"];
            action: string;
            target: {
                type: string;
                id: components["schemas"]["Uuid"];
            };
            /** @enum {string} */
            outcome: "success" | "denied";
            request_id: string;
        };
        AuditEventCollection: {
            items: components["schemas"]["AuditEvent"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        LeadRequest: {
            name: string;
            /** Format: email */
            email: string;
            organization_name: string;
            message?: string;
            /** @constant */
            consent: true;
            challenge_token: string;
            /** @description Honeypot; debe llegar vacío. */
            website?: string;
        };
        LeadReceipt: {
            id: components["schemas"]["Uuid"];
            /** @constant */
            state: "received";
            created_at: components["schemas"]["Timestamp"];
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
        /**
         * Format: uuid
         * @description UUIDv7 generado por la aplicación.
         */
        Uuid: string;
        Slug: string;
        /** @enum {string} */
        Role: "org_owner" | "security_admin" | "site_editor" | "event_manager" | "application_reviewer" | "checkin_staff" | "checkin_supervisor" | "report_viewer";
        /** @example sites:write */
        Scope: string;
        /**
         * Format: date-time
         * @description Fecha UTC en RFC 3339.
         */
        Timestamp: string;
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
        /** @description Cursor para la página siguiente, o `null` si no hay más. */
        NextCursor: string | null;
        /** @example es-PE */
        Locale: string;
        Revision: number;
        Reason: {
            reason: string;
        };
        Actor: {
            /** @enum {string} */
            type: "user" | "service" | "system";
            id: components["schemas"]["Uuid"];
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
        /** @description No existe o no es visible para quien llama. */
        NotFound: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description El cuerpo no cumple el contrato. */
        ValidationFailed: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Conflicto de estado, de unicidad o de idempotencia. */
        Conflict: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description El `If-Match` no coincide con la revisión actual. */
        PreconditionFailed: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Falta el header `If-Match`. */
        PreconditionRequired: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
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
    };
    parameters: {
        /** @description Token de la invitación (se guarda solo como hash). */
        InvitationToken: string;
        /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
        RequestId: string;
        /** @description Cursor opaco devuelto en `next_cursor`. */
        Cursor: string;
        Limit: number;
        IdPath: components["schemas"]["Uuid"];
        /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
        IdempotencyKey: string;
        /** @description ETag de la revisión que se modifica. Si no coincide → 412; si falta → 428. */
        IfMatch: string;
    };
    requestBodies: never;
    headers: {
        /** @description Identificador del request (el recibido si era válido, o uno nuevo). */
        RequestId: string;
        /** @description Las respuestas privadas no se cachean. */
        NoStore: "no-store";
        /** @description Revisión del recurso. Se envía en `If-Match` para modificarlo. */
        ETag: string;
        /** @description Destino de la redirección. */
        Location: string;
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
    getMe: {
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
            /** @description Identidad de la sesión. */
            200: {
                headers: {
                    "X-Request-Id": components["headers"]["RequestId"];
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    getMyCapabilities: {
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
            /** @description Permisos efectivos. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Capabilities"];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    listMySessions: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
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
            /** @description Sesiones del usuario; nunca incluye refresh ni tokens. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
        };
    };
    revokeSession: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sesión revocada. Repetir la llamada también responde 204. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listMyOrganizations: {
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
            /** @description Organizaciones donde el usuario tiene membresía activa. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MyOrganizationCollection"];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    switchSessionContext: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionContextRequest"];
            };
        };
        responses: {
            /** @description Contexto nuevo; el gateway reemite la sesión. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionContext"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    listRoles: {
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
            /** @description Roles del contrato de autorización. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoleCollection"];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    createOrganization: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganizationCreate"];
            };
        };
        responses: {
            /** @description Organización activa con su membresía owner. */
            201: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    Location: components["headers"]["Location"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    getOrganization: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Organización. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    updateOrganization: {
        parameters: {
            query?: never;
            header: {
                /** @description ETag de la revisión que se modifica. Si no coincide → 412; si falta → 428. */
                "If-Match": components["parameters"]["IfMatch"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/merge-patch+json": components["schemas"]["OrganizationPatch"];
            };
        };
        responses: {
            /** @description Organización actualizada. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            412: components["responses"]["PreconditionFailed"];
            422: components["responses"]["ValidationFailed"];
            428: components["responses"]["PreconditionRequired"];
        };
    };
    suspendOrganization: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Reason"];
            };
        };
        responses: {
            /** @description Organización suspendida. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    reactivateOrganization: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Reason"];
            };
        };
        responses: {
            /** @description Organización activa de nuevo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    listMemberships: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                state?: components["schemas"]["MembershipState"];
                role?: components["schemas"]["Role"];
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Miembros. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MembershipCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateMembership: {
        parameters: {
            query?: never;
            header: {
                /** @description ETag de la revisión que se modifica. Si no coincide → 412; si falta → 428. */
                "If-Match": components["parameters"]["IfMatch"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/merge-patch+json": components["schemas"]["MembershipPatch"];
            };
        };
        responses: {
            /** @description Membresía actualizada; si aplica, sus sesiones se revocan. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Membership"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description Transición inválida o último owner. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            412: components["responses"]["PreconditionFailed"];
            422: components["responses"]["ValidationFailed"];
            428: components["responses"]["PreconditionRequired"];
        };
    };
    listInvitations: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invitaciones. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createInvitation: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationCreate"];
            };
        };
        responses: {
            /** @description Invitación pendiente. La respuesta nunca incluye el token. */
            201: {
                headers: {
                    Location: components["headers"]["Location"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Invitation"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    revokeInvitation: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invitación revocada. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Invitation"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
        };
    };
    acceptInvitation: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                /** @description Token de la invitación (se guarda solo como hash). */
                token: components["parameters"]["InvitationToken"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Membresía activa. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Membership"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            /** @description Invitación vencida, usada o revocada. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    declineInvitation: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                /** @description Token de la invitación (se guarda solo como hash). */
                token: components["parameters"]["InvitationToken"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invitación rechazada. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationOutcome"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            /** @description Invitación vencida, usada o revocada. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listOrganizationSessions: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sesiones con IP seudonimizada; nunca tokens. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listServiceAccounts: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service accounts, sin secretos. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceAccountCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createServiceAccount: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServiceAccountCreate"];
            };
        };
        responses: {
            /** @description Service account creada. El secreto se muestra solo en esta respuesta. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceAccountCreated"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    rotateServiceAccount: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RotationRequest"];
            };
        };
        responses: {
            /** @description Credencial nueva; la anterior vence al terminar el solapamiento. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Rotation"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    revokeServiceAccount: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Reason"];
            };
        };
        responses: {
            /** @description Service account revocada. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ServiceAccount"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    listDomains: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dominios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createDomain: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DomainCreate"];
            };
        };
        responses: {
            /** @description Dominio pendiente, con su challenge de verificación. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description El hostname ya está en uso. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            422: components["responses"]["ValidationFailed"];
        };
    };
    verifyDomain: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dominio `active` (con TLS) o `failed`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
        };
    };
    listAuditEvents: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                from?: components["schemas"]["Timestamp"];
                to?: components["schemas"]["Timestamp"];
                action?: string;
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Eventos de auditoría, del más reciente al más antiguo. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditEventCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createLead: {
        parameters: {
            query?: never;
            header: {
                /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                slug: components["schemas"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LeadRequest"];
            };
        };
        responses: {
            /** @description Solicitud recibida. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeadReceipt"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationFailed"];
            429: components["responses"]["TooManyRequests"];
        };
    };
}
