import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { createUuidV7, DomainError, systemClock, type Clock } from '@incuba/shared-kernel';
import { HttpProblem, problemFromDomainError } from './problem.ts';
import { acceptRequestId } from './request-id.ts';

export interface HttpAppOptions {
  serviceName: string;
  logLevel?: string;
  /** `false` en pruebas para no ensuciar la salida. */
  logger?: boolean;
  clock?: Clock;
  bodyLimit?: number;
  trustProxy?: boolean;
}

/** Tokens que viajan en la ruta o en la query y no deben quedar en los logs (spec 10.3). */
const TOKEN_IN_PATH = /(\/public\/v1\/(?:invitations|previews)\/)[^/?#]+/g;
const SECRET_QUERY = /([?&](?:code|state|token|access_token|client_secret)=)[^&#]*/gi;

export function redactUrl(url: string): string {
  return url.replace(TOKEN_IN_PATH, '$1[redacted]').replace(SECRET_QUERY, '$1[redacted]');
}

/** Lo mínimo de una respuesta de Fastify; acepta respuestas de cualquier servidor (HTTP/1, HTTP/2, plugins). */
export interface ReplyLike {
  request: { id: unknown };
  header(name: string, value: string): unknown;
  code(status: number): unknown;
  type(contentType: string): unknown;
  send(payload: unknown): unknown;
}

/** Responde un Problem Details (RFC 9457) con el request ID del request. */
export function sendProblem<R extends ReplyLike>(reply: R, problem: HttpProblem): R {
  for (const [name, value] of Object.entries(problem.headers)) reply.header(name, value);
  reply.code(problem.status);
  reply.type('application/problem+json');
  reply.send(problem.toProblem(String(reply.request.id)));
  return reply;
}

/** Traduce cualquier error a Problem Details sin filtrar detalles internos. */
export function toHttpProblem(error: unknown): HttpProblem {
  if (error instanceof HttpProblem) return error;
  if (error instanceof DomainError) return problemFromDomainError(error);
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  if (status === 413) {
    return new HttpProblem({ status: 413, code: 'payload_too_large', detail: 'El cuerpo supera el tamaño permitido.' });
  }
  if (status === 415) {
    return new HttpProblem({ status: 415, code: 'unsupported_media_type', detail: 'Tipo de contenido no admitido.' });
  }
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return new HttpProblem({ status: 400, code: 'bad_request', detail: 'La solicitud está mal formada.' });
  }
  return new HttpProblem({ status: 500, code: 'internal_error', detail: 'Error interno.' });
}

/**
 * Crea la app HTTP base de un servicio (spec 9.1): request ID, logs sin secretos, Problem Details para todo error,
 * `merge-patch+json` y formularios.
 */
export function createHttpApp(options: HttpAppOptions): FastifyInstance {
  const newId = createUuidV7(options.clock ?? systemClock);
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: options.logLevel ?? 'info',
            base: { service: options.serviceName },
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
              censor: '[redacted]',
            },
            serializers: {
              req: (req: { method: string; url: string; headers: Record<string, unknown> }) => ({
                method: req.method,
                url: redactUrl(req.url),
                headers: req.headers,
              }),
            },
          },
    genReqId: (req) => acceptRequestId(req.headers['x-request-id'], newId),
    logController: new LogController({ requestIdLogLabel: 'request_id' }),
    bodyLimit: options.bodyLimit ?? 1024 * 1024,
    trustProxy: options.trustProxy ?? false,
    return503OnClosing: true,
  });

  app.addContentTypeParser(
    'application/merge-patch+json',
    { parseAs: 'string' },
    app.getDefaultJsonParser('error', 'error'),
  );
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
  });

  app.setErrorHandler((error, request, reply) => {
    const problem = toHttpProblem(error);
    if (problem.status >= 500) request.log.error({ err: error }, 'error no controlado');
    return sendProblem(reply, problem);
  });

  app.setNotFoundHandler((_request, reply) =>
    sendProblem(reply, new HttpProblem({ status: 404, code: 'not_found', detail: 'La ruta no existe.' })),
  );

  return app;
}

/** Escucha y cierra limpio con SIGTERM/SIGINT (los contenedores paran con SIGTERM). */
export async function listen(app: FastifyInstance, port: number, host = '0.0.0.0'): Promise<void> {
  await app.listen({ port, host });
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'cerrando');
      void app.close().then(() => process.exit(0));
    });
  }
}
