// Contrato mínimo para probar http-kit sin depender de los contratos reales.
export const ITEM_ID = '01933f40-1a2b-7c3d-8e4f-5a6b7c8d9e0f';

const problemContent = (examples: Record<string, unknown> = {}) => ({
  'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' }, examples },
});

const itemContent = (examples: Record<string, unknown>) => ({
  'application/json': { schema: { $ref: '#/components/schemas/Item' }, examples },
});

export const testDocument = {
  openapi: '3.1.0',
  info: { title: 'Prueba', version: '1.0.0' },
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    schemas: {
      Problem: {
        type: 'object',
        required: ['type', 'title', 'status', 'code', 'request_id'],
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'integer' },
          code: { type: 'string' },
          detail: { type: 'string' },
          request_id: { type: 'string' },
          errors: { type: 'array' },
        },
      },
      Item: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'revision'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1 },
          revision: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
  paths: {
    '/items': {
      post: {
        operationId: 'createItem',
        'x-required-scope': 'items:write',
        parameters: [
          { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 16 } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['name'],
                properties: { name: { type: 'string', minLength: 1 } },
              },
              examples: { create: { value: { name: 'Uno' } } },
            },
          },
        },
        responses: {
          '201': {
            description: 'Creado',
            headers: { ETag: { schema: { type: 'string' } } },
            content: itemContent({ created: { value: { id: ITEM_ID, name: 'Uno', revision: 1 } } }),
          },
          '422': { description: 'Inválido', content: problemContent() },
        },
      },
    },
    '/items/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: {
        operationId: 'getItem',
        'x-required-scope': 'items:read',
        parameters: [{ name: 'fields', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10 } }],
        responses: {
          '200': {
            description: 'Ok',
            content: itemContent({
              item: { value: { id: ITEM_ID, name: 'Uno', revision: 1 } },
              renamed: { value: { id: ITEM_ID, name: 'Otro', revision: 2 } },
            }),
          },
          '404': {
            description: 'No existe',
            content: problemContent({
              not_found: {
                value: {
                  type: 'https://errors.example.pe/not-found',
                  title: 'Not found',
                  status: 404,
                  code: 'not_found',
                  request_id: 'fijo-del-ejemplo',
                },
              },
            }),
          },
        },
      },
      patch: {
        operationId: 'updateItem',
        'x-required-scope': 'items:write',
        parameters: [{ name: 'If-Match', in: 'header', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/merge-patch+json': {
              schema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } } },
              examples: { rename: { value: { name: 'Otro' } } },
            },
          },
        },
        responses: {
          '200': {
            description: 'Ok',
            content: itemContent({ renamed: { value: { id: ITEM_ID, name: 'Otro', revision: 2 } } }),
          },
        },
      },
    },
    '/pages/{path}': {
      get: {
        operationId: 'getPage',
        security: [],
        parameters: [{ name: 'path', in: 'path', required: true, schema: { type: 'string', pattern: '^/' } }],
        responses: {
          '200': {
            description: 'Ok',
            content: {
              'application/json': {
                schema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } },
                examples: { page: { value: { path: '/' } } },
              },
            },
          },
        },
      },
    },
  },
};
