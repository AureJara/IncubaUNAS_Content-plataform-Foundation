import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, HTTPMethods } from 'fastify';
import { sendProblem } from './app.ts';
import {
  isAnonymous,
  type Contract,
  type JsonSchema,
  type MediaSpec,
  type OperationSpec,
  type ParameterSpec,
} from './contract.ts';
import { assertNoMocksOutsideLocal, type AppEnv } from './env.ts';
import { withIdempotency, type IdempotencyStore } from './idempotency.ts';
import { mockResponse, preferredExample } from './mock.ts';
import { HttpProblem, type ProblemFieldError } from './problem.ts';
import { SchemaCompiler, type Validator } from './validation.ts';

/** Estado de una operación (spec 3.8). */
export type OperationState = 'example' | 'memory' | 'real';

/** Quién llama, según el token interno verificado (spec 9.9). */
export interface Principal {
  subject: string;
  organizationId?: string;
  membershipId?: string;
  roles: readonly string[];
  scopes: readonly string[];
  amr: readonly string[];
  /** Segundos desde epoch. */
  authTime?: number;
}

/** Autenticación y autorización; cada servicio la conecta con `authz` en su raíz de composición. */
export interface SecurityAdapter {
  /** Lanza 401 si no hay credencial válida. */
  authenticate(request: FastifyRequest, operation: OperationSpec): Promise<Principal>;
  /** Lanza 403 `forbidden` o `recent_auth_required`. */
  authorize(principal: Principal, operation: OperationSpec): void;
}

export interface HandlerContext {
  operation: OperationSpec;
  request: FastifyRequest;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
  principal: Principal | undefined;
  requestId: string;
  log: FastifyBaseLogger;
}

export interface HandlerResult {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Por defecto, el primero que declara la respuesta en el contrato. */
  contentType?: string;
}

/** Handler de una operación: el caso de uso sobre adaptadores en memoria o reales (spec 3.8). */
export interface OperationHandler {
  state: 'memory' | 'real';
  handle(context: HandlerContext): Promise<HandlerResult>;
}

export type Handlers = Readonly<Record<string, OperationHandler>>;

export interface RegisterContractOptions {
  contract: Contract;
  handlers: Handlers;
  appEnv: AppEnv;
  /** Obligatorio si alguna operación exige autenticación. */
  security?: SecurityAdapter;
  /** Si falta, `Idempotency-Key` solo se valida, no se recuerda. */
  idempotency?: IdempotencyStore;
  /** Valida cada respuesta contra el contrato (MOCK-02). Por defecto, fuera de producción. */
  validateResponses?: boolean;
}

/** Headers que no se validan como parámetros: el request ID inválido se reemplaza, no se rechaza (spec 9.1). */
const SKIPPED_HEADERS = new Set(['x-request-id']);

type Location = 'path' | 'query' | 'header';
const PREFIX: Readonly<Record<Location, string>> = { path: '/path', query: '/query', header: '/headers' };

type ContentValidators = ReadonlyMap<string, Validator | undefined>;

interface CompiledOperation {
  op: OperationSpec;
  validators: Partial<Record<Location, Validator>>;
  bodies: ContentValidators;
  responses: ReadonlyMap<number, ContentValidators>;
  ifMatch: boolean;
  idempotencyKey: boolean;
  /** `/oauth/token` responde errores RFC 6749, no Problem Details. */
  oauthErrors: boolean;
}

/** Lo que el handler recibe después de validar el request. */
interface ValidatedRequest {
  principal: Principal | undefined;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
}

// ——— Compilación (una vez por operación, al arrancar) ———

function parametersSchema(params: readonly ParameterSpec[], location: Location): JsonSchema | undefined {
  const list = params.filter(
    (p) => p.in === location && !(location === 'header' && SKIPPED_HEADERS.has(p.name.toLowerCase())),
  );
  // La query rechaza parámetros desconocidos; la ruta y los headers no.
  if (list.length === 0 && location !== 'query') return undefined;
  const key = (p: ParameterSpec) => (location === 'header' ? p.name.toLowerCase() : p.name);
  const required = list.filter((p) => p.required).map(key);
  const schema: Record<string, unknown> = {
    type: 'object',
    properties: Object.fromEntries(list.map((p) => [key(p), p.schema])),
    additionalProperties: location !== 'query',
  };
  if (required.length > 0) schema['required'] = required;
  return schema;
}

function compileContent(content: Readonly<Record<string, MediaSpec>>, compiler: SchemaCompiler): ContentValidators {
  return new Map(
    Object.entries(content).map(([type, media]) => [
      type,
      media.schema === undefined ? undefined : compiler.body(media.schema),
    ]),
  );
}

function usesOAuthErrors(op: OperationSpec): boolean {
  const badRequest = op.responses.find((r) => r.status === 400)?.content ?? {};
  return 'application/json' in badRequest && !('application/problem+json' in badRequest);
}

function compile(op: OperationSpec, compiler: SchemaCompiler): CompiledOperation {
  const validators: Partial<Record<Location, Validator>> = {};
  for (const location of ['path', 'query', 'header'] as const) {
    const schema = parametersSchema(op.parameters, location);
    if (schema !== undefined) validators[location] = compiler.parameters(schema, PREFIX[location]);
  }
  const header = (name: string) => op.parameters.find((p) => p.in === 'header' && p.name.toLowerCase() === name);
  return {
    op,
    validators,
    bodies: compileContent(op.requestBody?.content ?? {}, compiler),
    responses: new Map(op.responses.map((r) => [r.status, compileContent(r.content, compiler)])),
    ifMatch: header('if-match')?.required === true,
    idempotencyKey: header('idempotency-key') !== undefined,
    oauthErrors: usesOAuthErrors(op),
  };
}

// ——— Validación del request ———

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first.trim() === '' ? undefined : first;
}

/**
 * RN-05: el tenant sale del token; si el cliente lo manda en la query o en un header, se rechaza. En el cuerpo lo
 * rechaza el schema (`additionalProperties: false`), salvo donde el contrato lo pide a propósito: elegir la
 * organización activa de la sesión (`SessionContextRequest`).
 */
function rejectClientTenant(request: FastifyRequest): void {
  const errors: ProblemFieldError[] = [];
  const query = request.query as Record<string, unknown> | undefined;
  if (query && 'organization_id' in query)
    errors.push({ pointer: '/query/organization_id', detail: 'el tenant sale del token' });
  if (request.headers['x-organization-id'] !== undefined) {
    errors.push({ pointer: '/headers/x-organization-id', detail: 'el tenant sale del token' });
  }
  if (errors.length > 0) {
    throw new HttpProblem({
      status: 422,
      code: 'validation_failed',
      detail: 'No envíes el tenant: sale del token.',
      errors,
    });
  }
}

function requireIfMatch(compiled: CompiledOperation, request: FastifyRequest): void {
  if (compiled.ifMatch && headerValue(request, 'if-match') === undefined) {
    throw new HttpProblem({
      status: 428,
      code: 'precondition_required',
      detail: 'Envía el ETag de la revisión en `If-Match`.',
    });
  }
}

function validateParameters(compiled: CompiledOperation, input: ValidatedRequest): void {
  const errors = [
    ...(compiled.validators.path?.(input.params) ?? []),
    ...(compiled.validators.query?.(input.query) ?? []),
    ...(compiled.validators.header?.(input.headers) ?? []),
  ];
  if (errors.length > 0)
    throw new HttpProblem({ status: 400, code: 'bad_request', detail: 'Parámetros inválidos.', errors });
}

/** Tipo de contenido sin parámetros, o `undefined` si no hay cuerpo. */
function bodyMediaType(request: FastifyRequest): string | undefined {
  if (request.body === undefined || request.body === null) return undefined;
  return headerValue(request, 'content-type')?.split(';')[0]?.trim().toLowerCase();
}

function validateBody(compiled: CompiledOperation, request: FastifyRequest): unknown {
  const spec = compiled.op.requestBody;
  if (spec === undefined) return undefined;
  const type = bodyMediaType(request);
  if (type === undefined) {
    if (!spec.required) return undefined;
    throw new HttpProblem({
      status: 422,
      code: 'validation_failed',
      detail: 'Falta el cuerpo.',
      errors: [{ pointer: '/', detail: 'es obligatorio' }],
    });
  }
  if (!compiled.bodies.has(type)) {
    throw new HttpProblem({
      status: 415,
      code: 'unsupported_media_type',
      detail: `Usa ${[...compiled.bodies.keys()].join(' o ')}.`,
    });
  }
  const errors = compiled.bodies.get(type)?.(request.body) ?? [];
  if (errors.length > 0) {
    throw new HttpProblem({
      status: 422,
      code: 'validation_failed',
      detail: 'El cuerpo no cumple el contrato.',
      errors,
    });
  }
  return request.body;
}

/** Orden: autenticación (401), autorización (403), `If-Match` (428), tenant (422), parámetros (400), cuerpo (415/422). */
async function validateRequest(
  compiled: CompiledOperation,
  request: FastifyRequest,
  security: SecurityAdapter | undefined,
): Promise<ValidatedRequest> {
  let principal: Principal | undefined;
  if (!isAnonymous(compiled.op) && security !== undefined) {
    principal = await security.authenticate(request, compiled.op);
    security.authorize(principal, compiled.op);
  }
  requireIfMatch(compiled, request);
  rejectClientTenant(request);
  const input: ValidatedRequest = {
    principal,
    params: { ...(request.params as Record<string, unknown>) },
    query: { ...(request.query as Record<string, unknown>) },
    headers: { ...request.headers },
    body: undefined,
  };
  validateParameters(compiled, input);
  input.body = validateBody(compiled, request);
  return input;
}

// ——— Ejecución ———

function mockResult(op: OperationSpec, request: FastifyRequest): HandlerResult {
  const preferred = preferredExample(request.headers.prefer);
  const mock = mockResponse(op, preferred);
  if (mock === undefined) {
    throw new HttpProblem({ status: 500, code: 'internal_error', detail: 'La operación no tiene ejemplo.' });
  }
  const headers = { ...mock.headers };
  if (mock.example !== undefined && preferred === mock.example)
    headers['preference-applied'] = `example=${mock.example}`;
  const result: HandlerResult = { status: mock.status, headers, body: mock.body };
  if (mock.contentType !== undefined) result.contentType = mock.contentType;
  return result;
}

async function execute(
  compiled: CompiledOperation,
  handler: OperationHandler | undefined,
  request: FastifyRequest,
  input: ValidatedRequest,
  idempotency: IdempotencyStore | undefined,
): Promise<HandlerResult> {
  const { op } = compiled;
  const run = async (): Promise<HandlerResult> =>
    handler === undefined
      ? mockResult(op, request)
      : handler.handle({ ...input, operation: op, request, requestId: String(request.id), log: request.log });
  const key = compiled.idempotencyKey ? headerValue(request, 'idempotency-key') : undefined;
  if (idempotency === undefined || key === undefined) return run();
  const scope = `${input.principal?.organizationId ?? '-'}|${input.principal?.subject ?? '-'}|${op.operationId}`;
  return withIdempotency(idempotency, { scope, key, body: input.body }, run);
}

// ——— Respuesta ———

function contractViolation(
  compiled: CompiledOperation,
  status: number,
  contentType: string | undefined,
  body: unknown,
) {
  const byType = compiled.responses.get(status);
  if (byType === undefined) return `estado ${status} no declarado`;
  if (body === undefined) return byType.size === 0 ? undefined : 'falta el cuerpo';
  if (contentType === undefined || !byType.has(contentType)) return `tipo ${contentType ?? '(ninguno)'} no declarado`;
  const errors = byType.get(contentType)?.(body) ?? [];
  return errors.length === 0 ? undefined : errors.map((e) => `${e.pointer} ${e.detail}`).join('; ');
}

/** Tipo de contenido y cuerpo finales; el ejemplo de un error trae un request ID fijo y se cambia por el real. */
function finalPayload(compiled: CompiledOperation, result: HandlerResult, requestId: string) {
  const declared = compiled.responses.get(result.status);
  const contentType = result.contentType ?? (declared ? [...declared.keys()][0] : undefined);
  const isProblem =
    contentType === 'application/problem+json' && typeof result.body === 'object' && result.body !== null;
  const body = isProblem ? { ...(result.body as Record<string, unknown>), request_id: requestId } : result.body;
  return { contentType, body };
}

function sendOAuthError(reply: FastifyReply, problem: HttpProblem): FastifyReply {
  const unauthorized = problem.status === 401;
  return reply
    .code(unauthorized ? 401 : 400)
    .type('application/json')
    .header('cache-control', 'no-store')
    .send({
      error: unauthorized ? 'invalid_client' : 'invalid_request',
      error_description: problem.detail ?? problem.code,
    });
}

function respond(
  compiled: CompiledOperation,
  state: OperationState,
  request: FastifyRequest,
  reply: FastifyReply,
  result: HandlerResult,
  validateResponses: boolean,
): FastifyReply {
  const { contentType, body } = finalPayload(compiled, result, String(request.id));
  const violation = validateResponses ? contractViolation(compiled, result.status, contentType, body) : undefined;
  if (violation !== undefined) {
    request.log.error({ operationId: compiled.op.operationId, violation }, 'respuesta fuera de contrato');
    return sendProblem(
      reply,
      new HttpProblem({ status: 500, code: 'internal_error', detail: 'La respuesta no cumple el contrato.' }),
    );
  }
  for (const [name, value] of Object.entries(result.headers ?? {})) reply.header(name, value);
  if (state !== 'real') reply.header('x-mock', state);
  reply.code(result.status);
  if (body === undefined) return reply.send();
  return reply.type(contentType ?? 'application/json').send(body);
}

// ——— Registro ———

function assertStartable(options: RegisterContractOptions): void {
  const { contract, handlers, appEnv, security } = options;
  const known = new Set(contract.operations.map((op) => op.operationId));
  const unknown = Object.keys(handlers).filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`Handlers sin operación en el contrato: ${unknown.join(', ')}`);

  const mocked = contract.operations.filter((op) => handlers[op.operationId] === undefined).map((op) => op.operationId);
  const usesMemory = Object.values(handlers).some((h) => h.state === 'memory');
  assertNoMocksOutsideLocal(appEnv, { mockedOperations: mocked, dataSource: usesMemory ? 'memory' : 'real' });

  const secured = contract.operations.filter((op) => !isAnonymous(op)).map((op) => op.operationId);
  if (security === undefined && secured.length > 0)
    throw new Error(`Falta el SecurityAdapter para: ${secured.join(', ')}`);
}

/**
 * Registra todas las operaciones del contrato (spec 3.4 y 3.8). Las que tienen handler responden con su caso de uso;
 * las demás, con el mock de contrato. Devuelve el estado de cada operación para el health `ready` (MOCK-04).
 */
export function registerContract(
  app: FastifyInstance,
  options: RegisterContractOptions,
): Readonly<Record<string, OperationState>> {
  assertStartable(options);
  const { contract, handlers, security, idempotency } = options;
  const validateResponses = options.validateResponses ?? options.appEnv !== 'production';
  const compiler = new SchemaCompiler();
  const states: Record<string, OperationState> = {};

  for (const op of contract.operations) {
    const compiled = compile(op, compiler);
    const handler = handlers[op.operationId];
    const state: OperationState = handler?.state ?? 'example';
    states[op.operationId] = state;

    app.route({
      method: op.method.toUpperCase() as HTTPMethods,
      url: op.routePath,
      handler: async (request, reply) => {
        let input: ValidatedRequest;
        try {
          input = await validateRequest(compiled, request, security);
        } catch (error) {
          if (compiled.oauthErrors && error instanceof HttpProblem && error.status < 500)
            return sendOAuthError(reply, error);
          throw error;
        }
        const result = await execute(compiled, handler, request, input, idempotency);
        return respond(compiled, state, request, reply, result, validateResponses);
      },
    });
  }

  return states;
}
