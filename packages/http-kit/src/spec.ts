import { dereference } from '@apidevtools/json-schema-ref-parser';
import type { SecurityRequirement } from './types.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

type JsonSchema = Record<string, unknown>;

export interface ApiOperation {
  operationId: string;
  method: HttpMethod;
  /** Ruta tal como está en OpenAPI: `/orgs/{organization_id}`. */
  openApiPath: string;
  /** Ruta de Fastify: `/orgs/:organization_id`. */
  url: string;
  security: SecurityRequirement[] | undefined;
  schema: {
    params?: JsonSchema;
    querystring?: JsonSchema;
    headers?: JsonSchema;
    body?: JsonSchema;
  };
  /** Media types aceptados en el cuerpo. */
  bodyMediaTypes: string[];
  /** Códigos de respuesta declarados. */
  responseStatuses: string[];
  /** Esquemas de respuesta por código y media type, para pruebas de conformidad. */
  responses: Record<string, Record<string, JsonSchema | undefined>>;
}

interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: JsonSchema;
}

/**
 * Headers que no se validan con el esquema de Fastify porque tienen su propio error estable:
 * `If-Match` lo valida `parseIfMatch` y `X-CSRF-Token` lo valida el hook de autenticación.
 */
const HEADERS_VALIDATED_ELSEWHERE = new Set(['if-match', 'x-csrf-token']);

const objectSchema = (
  parameters: OpenApiParameter[],
  lowerCase = false,
): JsonSchema | undefined => {
  if (parameters.length === 0) return undefined;
  const key = (name: string) => (lowerCase ? name.toLowerCase() : name);
  return {
    type: 'object',
    properties: Object.fromEntries(parameters.map((p) => [key(p.name), p.schema ?? {}])),
    required: parameters.filter((p) => p.required).map((p) => key(p.name)),
  };
};

/** Carga un OpenAPI con todas sus referencias resueltas y lo convierte en operaciones enlazables. */
export async function loadOperations(file: string): Promise<ApiOperation[]> {
  const document = (await dereference(file)) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const operations: ApiOperation[] = [];

  for (const [openApiPath, item] of Object.entries(document.paths)) {
    const shared = (item.parameters as OpenApiParameter[] | undefined) ?? [];
    for (const method of METHODS) {
      const op = item[method.toLowerCase()] as
        | {
            operationId?: string;
            security?: SecurityRequirement[];
            parameters?: OpenApiParameter[];
            requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
            responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
          }
        | undefined;
      if (!op) continue;
      if (!op.operationId) throw new Error(`${method} ${openApiPath} no tiene operationId`);

      const parameters = [...shared, ...(op.parameters ?? [])];
      const headers = parameters.filter(
        (p) => p.in === 'header' && !HEADERS_VALIDATED_ELSEWHERE.has(p.name.toLowerCase()),
      );
      const bodyContent = op.requestBody?.content ?? {};
      const bodyMediaTypes = Object.keys(bodyContent);

      operations.push({
        operationId: op.operationId,
        method,
        openApiPath,
        url: openApiPath.replace(/\{([^}]+)\}/g, ':$1'),
        security: op.security,
        schema: {
          params: objectSchema(parameters.filter((p) => p.in === 'path')),
          querystring: objectSchema(parameters.filter((p) => p.in === 'query')),
          headers: objectSchema(headers, true),
          body: bodyContent[bodyMediaTypes[0] ?? '']?.schema,
        },
        bodyMediaTypes,
        responseStatuses: Object.keys(op.responses ?? {}),
        responses: Object.fromEntries(
          Object.entries(op.responses ?? {}).map(([status, response]) => [
            status,
            Object.fromEntries(
              Object.entries(response.content ?? {}).map(([mediaType, media]) => [
                mediaType,
                media.schema,
              ]),
            ),
          ]),
        ),
      });
    }
  }
  return operations;
}
