import { readFile } from 'node:fs/promises';
import { dereference } from './deref.ts';

export type JsonSchema = Record<string, unknown> | boolean;

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface ExampleSpec {
  summary?: string;
  value: unknown;
}

export interface MediaSpec {
  schema?: JsonSchema;
  examples: Readonly<Record<string, ExampleSpec>>;
}

export interface ParameterSpec {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema: JsonSchema;
}

export interface HeaderSpec {
  schema?: JsonSchema;
  example?: unknown;
}

export interface ResponseSpec {
  status: number;
  headers: Readonly<Record<string, HeaderSpec>>;
  content: Readonly<Record<string, MediaSpec>>;
}

export interface RequestBodySpec {
  required: boolean;
  content: Readonly<Record<string, MediaSpec>>;
}

export type SecurityRequirement = Readonly<Record<string, readonly string[]>>;

/** Una operación del contrato, ya sin referencias (spec 3.4: handlers por `operationId`). */
export interface OperationSpec {
  operationId: string;
  method: HttpMethod;
  path: string;
  /** Ruta en la sintaxis de Fastify (`{id}` → `:id`). */
  routePath: string;
  parameters: readonly ParameterSpec[];
  requestBody: RequestBodySpec | undefined;
  /** Ordenadas por estado HTTP ascendente. */
  responses: readonly ResponseSpec[];
  security: readonly SecurityRequirement[];
  requiredScope: string | undefined;
  requiredRole: string | undefined;
  recentMfa: boolean;
}

export interface Contract {
  title: string;
  version: string;
  operations: readonly OperationSpec[];
  operation(operationId: string): OperationSpec;
}

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const obj = (value: unknown): Obj => (isObj(value) ? value : {});

function media(content: unknown): Record<string, MediaSpec> {
  return Object.fromEntries(
    Object.entries(obj(content)).map(([type, spec]) => {
      const m = obj(spec);
      const examples = Object.fromEntries(
        Object.entries(obj(m['examples'])).map(([name, ex]) => {
          const e = obj(ex);
          const example: ExampleSpec = { value: e['value'] };
          if (typeof e['summary'] === 'string') example.summary = e['summary'];
          return [name, example];
        }),
      );
      const result: MediaSpec = { examples };
      if (m['schema'] !== undefined) result.schema = m['schema'] as JsonSchema;
      return [type, result];
    }),
  );
}

function parameters(pathLevel: unknown, opLevel: unknown): ParameterSpec[] {
  const merged = new Map<string, ParameterSpec>();
  const all = [...(Array.isArray(pathLevel) ? pathLevel : []), ...(Array.isArray(opLevel) ? opLevel : [])];
  for (const raw of all) {
    const p = obj(raw);
    const location = p['in'] as ParameterSpec['in'];
    const name = String(p['name']);
    merged.set(`${location}:${name.toLowerCase()}`, {
      name,
      in: location,
      required: p['required'] === true || location === 'path',
      schema: (p['schema'] as JsonSchema | undefined) ?? true,
    });
  }
  return [...merged.values()];
}

function headers(raw: unknown): Record<string, HeaderSpec> {
  return Object.fromEntries(
    Object.entries(obj(raw)).map(([name, h]) => {
      const header = obj(h);
      const result: HeaderSpec = {};
      if (header['schema'] !== undefined) result.schema = header['schema'] as JsonSchema;
      if (header['example'] !== undefined) result.example = header['example'];
      return [name, result];
    }),
  );
}

function responses(raw: unknown, operationId: string): ResponseSpec[] {
  return Object.entries(obj(raw))
    .map(([status, spec]) => {
      const code = Number.parseInt(status, 10);
      if (!Number.isInteger(code)) throw new Error(`${operationId}: estado de respuesta no admitido: ${status}`);
      const r = obj(spec);
      return { status: code, headers: headers(r['headers']), content: media(r['content']) };
    })
    .sort((a, b) => a.status - b.status);
}

function toOperation(path: string, method: HttpMethod, item: Obj, op: Obj, globalSecurity: SecurityRequirement[]) {
  const operationId = op['operationId'];
  if (typeof operationId !== 'string') throw new Error(`${method.toUpperCase()} ${path}: falta operationId`);
  const body = isObj(op['requestBody']) ? op['requestBody'] : undefined;
  const operation: OperationSpec = {
    operationId,
    method,
    path,
    routePath: path.replace(/\{([^}]+)\}/g, ':$1'),
    parameters: parameters(item['parameters'], op['parameters']),
    requestBody: body ? { required: body['required'] === true, content: media(body['content']) } : undefined,
    responses: responses(op['responses'], operationId),
    security: Array.isArray(op['security']) ? (op['security'] as SecurityRequirement[]) : globalSecurity,
    requiredScope: typeof op['x-required-scope'] === 'string' ? op['x-required-scope'] : undefined,
    requiredRole: typeof op['x-required-role'] === 'string' ? op['x-required-role'] : undefined,
    recentMfa: op['x-recent-mfa'] === true,
  };
  return operation;
}

/** Construye las operaciones a partir de un documento OpenAPI 3.1 empaquetado (`contracts/dist/*.json`). */
export function loadContract(document: unknown): Contract {
  const doc = obj(dereference(document));
  const info = obj(doc['info']);
  const globalSecurity = Array.isArray(doc['security']) ? (doc['security'] as SecurityRequirement[]) : [];
  const operations: OperationSpec[] = [];

  for (const [path, rawItem] of Object.entries(obj(doc['paths']))) {
    const item = obj(rawItem);
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (isObj(op)) operations.push(toOperation(path, method, item, op, globalSecurity));
    }
  }

  const byId = new Map(operations.map((op) => [op.operationId, op]));
  if (byId.size !== operations.length) throw new Error('operationId repetido en el contrato');

  return {
    title: String(info['title'] ?? ''),
    version: String(info['version'] ?? ''),
    operations,
    operation(operationId) {
      const op = byId.get(operationId);
      if (!op) throw new Error(`El contrato no tiene la operación ${operationId}`);
      return op;
    },
  };
}

/** Lee un contrato empaquetado desde disco. */
export async function readContract(file: string | URL): Promise<Contract> {
  return loadContract(JSON.parse(await readFile(file, 'utf8')));
}

/** `true` si la operación admite llamadas sin autenticación (`security: []` o una alternativa vacía). */
export function isAnonymous(operation: OperationSpec): boolean {
  return operation.security.length === 0 || operation.security.some((req) => Object.keys(req).length === 0);
}
