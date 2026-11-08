// Generado por `pnpm contracts:build` desde contracts/dist/cms.json. No editar a mano.

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
    "/cms/v1/sites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sitios de la organización */
        get: operations["listSites"];
        put?: never;
        /** Crear un sitio en borrador */
        post: operations["createSite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/sites/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Configuración del sitio */
        get: operations["getSite"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Configurar el sitio */
        patch: operations["updateSite"];
        trace?: never;
    };
    "/cms/v1/sites/{id}/theme": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Guardar una versión nueva del tema
         * @description Tokens de una allowlist con contraste AA validado (PF-038, RN-18).
         */
        put: operations["putSiteTheme"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/sites/{id}/navigation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Guardar una versión nueva de la navegación
         * @description Enlaces solo relativos o `https:` (RN-18).
         */
        put: operations["putSiteNavigation"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/sites/{id}/pages": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Páginas del sitio */
        get: operations["listPages"];
        put?: never;
        /** Crear una página en borrador */
        post: operations["createPage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/pages/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Borrador de la página y su revisión */
        get: operations["getPage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Guardar el borrador (revisión nueva)
         * @description Autosave con control de conflicto; el 412 se muestra en la UI (PF-031).
         */
        patch: operations["updatePage"];
        trace?: never;
    };
    "/cms/v1/pages/{id}/preview-tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Crear una vista previa corta y de un uso */
        post: operations["createPreviewToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/pages/{id}/publications": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["IdPath"];
            };
            cookie?: never;
        };
        /** Historial de publicaciones */
        get: operations["listPublications"];
        put?: never;
        /**
         * Publicar una versión inmutable
         * @description Crea el snapshot con su hash, pasa la publicación anterior a `superseded` y escribe `content.page.published.v1` en el outbox (spec 3.6 flujo C).
         */
        post: operations["publishPage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/pages/{id}/restorations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restaurar una versión previa como publicación nueva
         * @description El snapshot viejo nunca cambia (RN-13).
         */
        post: operations["restorePublication"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/media-uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pedir una URL de subida firmada
         * @description MIME de una allowlist (sin SVG), tamaño máximo y hash (PF-032).
         */
        post: operations["createMediaUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/media/{id}/completion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Confirmar la subida y lanzar el antivirus */
        post: operations["completeMediaUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cms/v1/media": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Biblioteca de medios */
        get: operations["listMedia"];
        put?: never;
        post?: never;
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
        SiteKind: "product" | "demo" | "client";
        /**
         * @description Estados del sitio **(propuesta)**.
         * @enum {string}
         */
        SiteState: "draft" | "live" | "archived";
        /** @description Ruta de la página, en minúsculas; `/` es la portada. */
        PagePath: string;
        /** @description Solo una ruta del mismo sitio (`/…`, nunca `//…`) o `https:` (RN-18). */
        Link: string;
        HexColor: string;
        ThemeTokens: {
            color_primary: components["schemas"]["HexColor"];
            color_on_primary: components["schemas"]["HexColor"];
            color_background: components["schemas"]["HexColor"];
            color_text: components["schemas"]["HexColor"];
            /** @enum {string} */
            font_family: "system" | "serif" | "humanist";
            /** @enum {string} */
            radius: "none" | "small" | "medium";
        };
        ThemeInput: {
            tokens: components["schemas"]["ThemeTokens"];
        };
        Theme: {
            revision: components["schemas"]["Revision"];
            tokens: components["schemas"]["ThemeTokens"];
            updated_at: components["schemas"]["Timestamp"];
        };
        NavigationItem: {
            label: string;
            href: components["schemas"]["Link"];
        };
        NavigationInput: {
            items: components["schemas"]["NavigationItem"][];
        };
        Navigation: {
            revision: components["schemas"]["Revision"];
            items: components["schemas"]["NavigationItem"][];
            updated_at: components["schemas"]["Timestamp"];
        };
        Site: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            name: string;
            kind: components["schemas"]["SiteKind"];
            locale: components["schemas"]["Locale"];
            state: components["schemas"]["SiteState"];
            theme: components["schemas"]["Theme"];
            navigation: components["schemas"]["Navigation"];
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        SiteCreate: {
            slug: components["schemas"]["Slug"];
            name: string;
            kind: components["schemas"]["SiteKind"];
            locale: components["schemas"]["Locale"];
        };
        SitePatch: {
            name?: string;
            locale?: components["schemas"]["Locale"];
            state?: components["schemas"]["SiteState"];
        };
        SiteSummary: {
            id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            name: string;
            kind: components["schemas"]["SiteKind"];
            locale: components["schemas"]["Locale"];
            state: components["schemas"]["SiteState"];
            updated_at: components["schemas"]["Timestamp"];
        };
        SiteCollection: {
            items: components["schemas"]["SiteSummary"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        /** @description Bloque tipado; cada tipo valida contra su JSON Schema versionado (PF-031). Lo distinguen las constantes `type` y `version` de cada schema, sin `discriminator`: el implícito tomaría el nombre del schema (`hero.v1`) en vez del valor de `type` (`hero`), y un mismo `type` puede tener varias versiones. */
        Block: components["schemas"]["hero.v1"] | components["schemas"]["rich_text.v1"] | components["schemas"]["image.v1"] | components["schemas"]["event_catalog.v1"] | components["schemas"]["featured_event.v1"] | components["schemas"]["agenda.v1"];
        Blocks: components["schemas"]["Block"][];
        Seo: {
            title?: string;
            description?: string;
            /** Format: uri */
            canonical?: string;
        };
        /**
         * @description `published` si tiene una publicación vigente; el borrador puede ser más nuevo.
         * @enum {string}
         */
        PageState: "draft" | "published";
        Page: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            site_id: components["schemas"]["Uuid"];
            path: components["schemas"]["PagePath"];
            locale: components["schemas"]["Locale"];
            title: string;
            seo: components["schemas"]["Seo"];
            blocks: components["schemas"]["Blocks"];
            state: components["schemas"]["PageState"];
            current_publication_id: components["schemas"]["Uuid"] | null;
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        PageCreate: {
            path: components["schemas"]["PagePath"];
            locale?: components["schemas"]["Locale"];
            title: string;
            seo?: components["schemas"]["Seo"];
            blocks: components["schemas"]["Blocks"];
        };
        PagePatch: {
            path?: components["schemas"]["PagePath"];
            title?: string;
            seo?: components["schemas"]["Seo"];
            blocks?: components["schemas"]["Blocks"];
        };
        PageSummary: {
            id: components["schemas"]["Uuid"];
            path: components["schemas"]["PagePath"];
            locale: components["schemas"]["Locale"];
            title: string;
            state: components["schemas"]["PageState"];
            current_publication_id: components["schemas"]["Uuid"] | null;
            revision: components["schemas"]["Revision"];
            updated_at: components["schemas"]["Timestamp"];
        };
        PageSummaryCollection: {
            items: components["schemas"]["PageSummary"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        PreviewTokenCreate: {
            /** @description 15 minutos como máximo (PF-033). */
            ttl_seconds: number;
        };
        PreviewToken: {
            /** Format: uri */
            url: string;
            expires_at: components["schemas"]["Timestamp"];
        };
        /** @enum {string} */
        PublicationState: "published" | "superseded";
        Publication: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            site_id: components["schemas"]["Uuid"];
            page_id: components["schemas"]["Uuid"];
            version: number;
            source_revision: components["schemas"]["Revision"];
            path: components["schemas"]["PagePath"];
            locale: components["schemas"]["Locale"];
            content_hash: string;
            state: components["schemas"]["PublicationState"];
            restored_from: components["schemas"]["Uuid"] | null;
            published_at: components["schemas"]["Timestamp"];
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        PublicationCreate: {
            expected_revision: components["schemas"]["Revision"];
        };
        RestorationCreate: {
            source_publication_id: components["schemas"]["Uuid"];
        };
        PublicationCollection: {
            items: components["schemas"]["Publication"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        /** @enum {string} */
        MediaState: "pending" | "scanning" | "ready" | "quarantined" | "retired";
        /**
         * @description Allowlist; SVG no se acepta (PF-032).
         * @enum {string}
         */
        MediaMime: "image/jpeg" | "image/png" | "image/webp" | "image/avif" | "application/pdf";
        Sha256Hex: string;
        Media: {
            id: components["schemas"]["Uuid"];
            organization_id: components["schemas"]["Uuid"];
            name: string;
            mime: components["schemas"]["MediaMime"];
            size: number;
            sha256: components["schemas"]["Sha256Hex"];
            alt: string | null;
            state: components["schemas"]["MediaState"];
            /**
             * Format: uri
             * @description Solo cuando el medio está `ready` (RN-17).
             */
            url: string | null;
            revision: components["schemas"]["Revision"];
            created_at: components["schemas"]["Timestamp"];
            updated_at: components["schemas"]["Timestamp"];
        };
        MediaUploadCreate: {
            name: string;
            mime: components["schemas"]["MediaMime"];
            size: number;
            sha256: components["schemas"]["Sha256Hex"];
            alt?: string;
        };
        MediaUpload: {
            media: components["schemas"]["Media"];
            upload: {
                /** @constant */
                method: "PUT";
                /** Format: uri */
                url: string;
                expires_at: components["schemas"]["Timestamp"];
            };
        };
        MediaCompletion: {
            size: number;
            sha256: components["schemas"]["Sha256Hex"];
        };
        MediaCollection: {
            items: components["schemas"]["Media"][];
            next_cursor: components["schemas"]["NextCursor"];
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
        /** @example es-PE */
        Locale: string;
        /**
         * Format: date-time
         * @description Fecha UTC en RFC 3339.
         */
        Timestamp: string;
        /** @description Cursor para la página siguiente, o `null` si no hay más. */
        NextCursor: string | null;
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
        Revision: number;
        /**
         * Bloque hero, versión 1
         * @description Encabezado de la página con imagen opcional y llamada a la acción (PF-031).
         */
        "hero.v1": {
            /** Format: uuid */
            id: string;
            /** @constant */
            type: "hero";
            /** @constant */
            version: 1;
            data: {
                heading: string;
                subheading?: string;
                /** Format: uuid */
                image_media_id?: string;
                image_alt?: string;
                cta?: {
                    label: string;
                    href: string;
                };
            };
        };
        /**
         * Bloque de texto enriquecido, versión 1
         * @description Texto estructurado en nodos y tramos. No acepta HTML (PF-031, SEC).
         */
        "rich_text.v1": {
            /** Format: uuid */
            id: string;
            /** @constant */
            type: "rich_text";
            /** @constant */
            version: 1;
            data: {
                nodes: {
                    /** @enum {string} */
                    kind: "paragraph" | "heading" | "list_item";
                    level?: number;
                    spans: {
                        text: string;
                        marks?: ("bold" | "italic" | "code")[];
                        href?: string;
                    }[];
                }[];
            };
        };
        /**
         * Bloque de imagen, versión 1
         * @description Imagen de la biblioteca de medios. El texto alternativo es obligatorio (RN-17).
         */
        "image.v1": {
            /** Format: uuid */
            id: string;
            /** @constant */
            type: "image";
            /** @constant */
            version: 1;
            data: {
                /** Format: uuid */
                media_id: string;
                alt: string;
                caption?: string;
            };
        };
        /**
         * Bloque de catálogo de eventos, versión 1
         * @description Guarda un filtro, nunca una copia de los eventos (PF-037).
         */
        "event_catalog.v1": {
            /** Format: uuid */
            id: string;
            /** @constant */
            type: "event_catalog";
            /** @constant */
            version: 1;
            data: {
                heading?: string;
                limit: number;
                filter?: {
                    /** @enum {string} */
                    modality?: "in_person" | "online" | "hybrid";
                    category?: string;
                    /** Format: date */
                    from?: string;
                    /** Format: date */
                    to?: string;
                };
            };
        };
        /**
         * Bloque de evento destacado, versión 1
         * @description Guarda el ID del evento y la publication de su release, no una copia (PF-037).
         */
        "featured_event.v1": {
            /** Format: uuid */
            id: string;
            /** @constant */
            type: "featured_event";
            /** @constant */
            version: 1;
            data: {
                /** Format: uuid */
                event_id: string;
                /** Format: uuid */
                publication_id: string;
            };
        };
        /**
         * Bloque de agenda, versión 1
         * @description Agenda de un evento según la publication de su release (PF-037).
         */
        "agenda.v1": {
            /** Format: uuid */
            id: string;
            /** @constant */
            type: "agenda";
            /** @constant */
            version: 1;
            data: {
                heading?: string;
                /** Format: uuid */
                event_id: string;
                /** Format: uuid */
                publication_id: string;
            };
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
    };
    parameters: {
        /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
        RequestId: string;
        /** @description Cursor opaco devuelto en `next_cursor`. */
        Cursor: string;
        Limit: number;
        /** @description Obligatorio en los POST de comando; se retiene al menos 24 h (spec 9.1). */
        IdempotencyKey: string;
        IdPath: components["schemas"]["Uuid"];
        /** @description ETag de la revisión que se modifica. Si no coincide → 412; si falta → 428. */
        IfMatch: string;
    };
    requestBodies: never;
    headers: {
        /** @description Las respuestas privadas no se cachean. */
        NoStore: "no-store";
        /** @description Identificador del request (el recibido si era válido, o uno nuevo). */
        RequestId: string;
        /** @description Revisión del recurso. Se envía en `If-Match` para modificarlo. */
        ETag: string;
        /** @description Destino de la redirección. */
        Location: string;
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
    listSites: {
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
            /** @description Sitios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SiteCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    createSite: {
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
                "application/json": components["schemas"]["SiteCreate"];
            };
        };
        responses: {
            /** @description Sitio en borrador. */
            201: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    Location: components["headers"]["Location"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Site"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description El slug ya existe en la organización. */
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
    getSite: {
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
            /** @description Sitio con su tema y navegación vigentes. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Site"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateSite: {
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
                "application/merge-patch+json": components["schemas"]["SitePatch"];
            };
        };
        responses: {
            /** @description Sitio actualizado. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Site"];
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
    putSiteTheme: {
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
                "application/json": components["schemas"]["ThemeInput"];
            };
        };
        responses: {
            /** @description Tema nuevo. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Theme"];
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
    putSiteNavigation: {
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
                "application/json": components["schemas"]["NavigationInput"];
            };
        };
        responses: {
            /** @description Navegación nueva. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Navigation"];
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
    listPages: {
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
            /** @description Páginas, sin sus bloques. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PageSummaryCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createPage: {
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
                "application/json": components["schemas"]["PageCreate"];
            };
        };
        responses: {
            /** @description Página en borrador. */
            201: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    Location: components["headers"]["Location"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page"];
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
    getPage: {
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
            /** @description Página con su borrador. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updatePage: {
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
                "application/merge-patch+json": components["schemas"]["PagePatch"];
            };
        };
        responses: {
            /** @description Revisión nueva del borrador. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Page"];
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
    createPreviewToken: {
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
                "application/json": components["schemas"]["PreviewTokenCreate"];
            };
        };
        responses: {
            /** @description URL de vista previa ligada al usuario. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PreviewToken"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    listPublications: {
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
            /** @description Publicaciones, de la más reciente a la más antigua. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicationCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    publishPage: {
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
                "application/json": components["schemas"]["PublicationCreate"];
            };
        };
        responses: {
            /** @description Publicación vigente. */
            201: {
                headers: {
                    Location: components["headers"]["Location"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Publication"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            412: components["responses"]["PreconditionFailed"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    restorePublication: {
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
                "application/json": components["schemas"]["RestorationCreate"];
            };
        };
        responses: {
            /** @description Publicación nueva basada en la elegida. */
            201: {
                headers: {
                    Location: components["headers"]["Location"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Publication"];
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
    createMediaUpload: {
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
                "application/json": components["schemas"]["MediaUploadCreate"];
            };
        };
        responses: {
            /** @description Medio `pending` y URL de subida corta. */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaUpload"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationFailed"];
        };
    };
    completeMediaUpload: {
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
                "application/json": components["schemas"]["MediaCompletion"];
            };
        };
        responses: {
            /** @description Medio en `scanning`; luego pasa a `ready` o `quarantined`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Media"];
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
    listMedia: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                state?: components["schemas"]["MediaState"];
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
            /** @description Medios. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MediaCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
}
