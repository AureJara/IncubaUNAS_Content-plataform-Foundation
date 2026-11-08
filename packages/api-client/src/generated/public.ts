// Generado por `pnpm contracts:build` desde contracts/dist/public.json. No editar a mano.

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
    "/public/v1/site-resolutions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Resolver host → sitio
         * @description El host se canoniza (minúsculas, sin puerto, IDN a punycode, sin punto final) y solo se resuelven dominios `active`. Devuelve IDs opacos (PF-022).
         */
        get: operations["resolveSite"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/sites/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Snapshot público del sitio */
        get: operations["getPublicSite"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/sites/{slug}/pages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Rutas publicadas, para el sitemap */
        get: operations["listPublishedPages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/sites/{slug}/pages/{path}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Página publicada */
        get: operations["getPublicPage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/sites/{slug}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Catálogo proyectado
         * @description Solo releases `active` (RN-14).
         */
        get: operations["listPublicEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/sites/{slug}/events/{event_slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Release público coherente
         * @description Todo lo que devuelve sale de la misma `publication_id` (PF-042).
         */
        get: operations["getPublicEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/previews/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Leer una vista previa
         * @description Un uso, ligada al usuario, sin caché y sin indexar (PF-033).
         */
        get: operations["getPreview"];
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
        Modality: "in_person" | "online" | "hybrid";
        PagePath: string;
        SiteResolution: {
            site_id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            locale: components["schemas"]["Locale"];
        };
        PublicTheme: {
            color_primary: string;
            color_on_primary: string;
            color_background: string;
            color_text: string;
            /** @enum {string} */
            font_family: "system" | "serif" | "humanist";
            /** @enum {string} */
            radius: "none" | "small" | "medium";
        };
        PublicSite: {
            site_id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            name: string;
            /**
             * @description `demo` muestra el banner "Demo" en todas las páginas (PF-041).
             * @enum {string}
             */
            kind: "product" | "demo" | "client";
            locale: components["schemas"]["Locale"];
            theme: components["schemas"]["PublicTheme"];
            navigation: {
                label: string;
                href: string;
            }[];
        };
        /** @description Bloque publicado. Lo distinguen las constantes `type` y `version` de cada schema (ver `Block` en cms.yaml). */
        Block: components["schemas"]["hero.v1"] | components["schemas"]["rich_text.v1"] | components["schemas"]["image.v1"] | components["schemas"]["event_catalog.v1"] | components["schemas"]["featured_event.v1"] | components["schemas"]["agenda.v1"];
        Seo: {
            title?: string;
            description?: string;
            /** Format: uri */
            canonical?: string;
        };
        PublicPage: {
            site_id: components["schemas"]["Uuid"];
            page_id: components["schemas"]["Uuid"];
            publication_id: components["schemas"]["Uuid"];
            path: components["schemas"]["PagePath"];
            locale: components["schemas"]["Locale"];
            title: string;
            seo: components["schemas"]["Seo"];
            blocks: components["schemas"]["Block"][];
            content_hash: string;
            published_at: components["schemas"]["Timestamp"];
        };
        Preview: {
            site_id: components["schemas"]["Uuid"];
            page_id: components["schemas"]["Uuid"];
            revision: components["schemas"]["Revision"];
            path: components["schemas"]["PagePath"];
            locale: components["schemas"]["Locale"];
            title: string;
            seo: components["schemas"]["Seo"];
            blocks: components["schemas"]["Block"][];
            expires_at: components["schemas"]["Timestamp"];
        };
        PublishedPage: {
            path: components["schemas"]["PagePath"];
            locale: components["schemas"]["Locale"];
            published_at: components["schemas"]["Timestamp"];
        };
        PublishedPageCollection: {
            items: components["schemas"]["PublishedPage"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        /** @description Orientativa; quien decide el cupo es Participation (RN-15). */
        Registration: {
            /** @enum {string} */
            status: "not_open" | "open" | "few_left" | "full" | "closed";
            as_of: components["schemas"]["Timestamp"];
        };
        PublicEventSummary: components["schemas"]["PublicEventFields"];
        /** @description Campos comunes del resumen y del detalle de un evento. */
        PublicEventFields: {
            event_id: components["schemas"]["Uuid"];
            publication_id: components["schemas"]["Uuid"];
            slug: components["schemas"]["Slug"];
            title: string;
            summary: string;
            /** @enum {string} */
            state: "scheduled" | "cancelled";
            modality: components["schemas"]["Modality"];
            starts_at: components["schemas"]["Timestamp"];
            ends_at: components["schemas"]["Timestamp"];
            timezone: string;
            venue_name?: string;
            registration: components["schemas"]["Registration"];
        };
        PublicEventCollection: {
            items: components["schemas"]["PublicEventSummary"][];
            next_cursor: components["schemas"]["NextCursor"];
        };
        PublicEvent: {
            /** @description Párrafos de texto plano. */
            description: string[];
            sessions: {
                id: components["schemas"]["Uuid"];
                title: string;
                starts_at: components["schemas"]["Timestamp"];
                ends_at: components["schemas"]["Timestamp"];
                location?: string;
            }[];
            programs: {
                id: components["schemas"]["Uuid"];
                name: string;
            }[];
        } & components["schemas"]["PublicEventFields"];
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
        /**
         * Format: date-time
         * @description Fecha UTC en RFC 3339.
         */
        Timestamp: string;
        /** @description Cursor para la página siguiente, o `null` si no hay más. */
        NextCursor: string | null;
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
        Revision: number;
    };
    responses: {
        /** @description El ETag coincide; se usa la copia cacheada. */
        NotModified: {
            headers: {
                ETag: components["headers"]["ETag"];
                [name: string]: unknown;
            };
            content?: never;
        };
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
    };
    parameters: {
        SiteSlug: components["schemas"]["Slug"];
        /** @description ETag ya cacheado; si coincide se responde 304. */
        IfNoneMatch: string;
        /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
        RequestId: string;
        /** @description Cursor opaco devuelto en `next_cursor`. */
        Cursor: string;
        Limit: number;
    };
    requestBodies: never;
    headers: {
        /**
         * @description Headers que cambian la respuesta.
         * @example Accept-Encoding
         */
        Vary: string;
        /** @description Las vistas previas no se indexan. */
        NoIndex: "noindex";
        /**
         * @description Caché pública por defecto (spec 9.5).
         * @example public, max-age=60, stale-while-revalidate=300
         */
        PublicCacheControl: string;
        /** @description Claves para purgar el CDN por sitio, página, publicación o evento. */
        SurrogateKey: string;
        /** @description Identificador del request (el recibido si era válido, o uno nuevo). */
        RequestId: string;
        /** @description Revisión del recurso. Se envía en `If-Match` para modificarlo. */
        ETag: string;
        /** @description Las respuestas privadas no se cachean. */
        NoStore: "no-store";
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
    resolveSite: {
        parameters: {
            query: {
                host: string;
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
            /** @description Sitio del host. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicCacheControl"];
                    "Surrogate-Key": components["headers"]["SurrogateKey"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SiteResolution"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    getPublicSite: {
        parameters: {
            query?: never;
            header?: {
                /** @description ETag ya cacheado; si coincide se responde 304. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                slug: components["parameters"]["SiteSlug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sitio con tema y navegación publicados. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    "Cache-Control": components["headers"]["PublicCacheControl"];
                    "Surrogate-Key": components["headers"]["SurrogateKey"];
                    Vary: components["headers"]["Vary"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicSite"];
                };
            };
            304: components["responses"]["NotModified"];
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    listPublishedPages: {
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
                slug: components["parameters"]["SiteSlug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Páginas con publicación vigente. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicCacheControl"];
                    "Surrogate-Key": components["headers"]["SurrogateKey"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublishedPageCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    getPublicPage: {
        parameters: {
            query?: {
                locale?: components["schemas"]["Locale"];
            };
            header?: {
                /** @description ETag ya cacheado; si coincide se responde 304. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                slug: components["parameters"]["SiteSlug"];
                /** @description Ruta de la página codificada como un solo segmento (`encodeURIComponent`): `/guia` se envía como `%2Fguia` y la portada como `%2F`. */
                path: components["schemas"]["PagePath"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Snapshot de la publicación vigente. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    "Cache-Control": components["headers"]["PublicCacheControl"];
                    "Surrogate-Key": components["headers"]["SurrogateKey"];
                    Vary: components["headers"]["Vary"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicPage"];
                };
            };
            304: components["responses"]["NotModified"];
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    listPublicEvents: {
        parameters: {
            query?: {
                /** @description Cursor opaco devuelto en `next_cursor`. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
                modality?: components["schemas"]["Modality"];
                category?: components["schemas"]["Slug"];
                from?: string;
                to?: string;
            };
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                slug: components["parameters"]["SiteSlug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Eventos del sitio. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["PublicCacheControl"];
                    "Surrogate-Key": components["headers"]["SurrogateKey"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicEventCollection"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    getPublicEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description ETag ya cacheado; si coincide se responde 304. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                slug: components["parameters"]["SiteSlug"];
                event_slug: components["schemas"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Evento, agenda y programas del release activo. */
            200: {
                headers: {
                    ETag: components["headers"]["ETag"];
                    "Cache-Control": components["headers"]["PublicCacheControl"];
                    "Surrogate-Key": components["headers"]["SurrogateKey"];
                    Vary: components["headers"]["Vary"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicEvent"];
                };
            };
            304: components["responses"]["NotModified"];
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    getPreview: {
        parameters: {
            query?: never;
            header?: {
                /** @description Se acepta si es válido; si no, se genera. Siempre se devuelve. */
                "X-Request-Id"?: components["parameters"]["RequestId"];
            };
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Borrador de la página en la revisión de la vista previa. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    "X-Robots-Tag": components["headers"]["NoIndex"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Preview"];
                };
            };
            400: components["responses"]["BadRequest"];
            /** @description Vista previa vencida, usada o inexistente. */
            404: {
                headers: {
                    "Cache-Control": components["headers"]["NoStore"];
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
