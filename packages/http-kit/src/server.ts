import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { uuidV7Generator } from '@incubaunas/shared-kernel';
import { createAuthHook, type AuthenticatorRegistry } from './auth.js';
import { redactUrl } from './redact.js';
import { installErrorHandling } from './errors.js';

export interface ServerOptions {
  serviceName: string;
  authenticators: AuthenticatorRegistry;
  /** Orígenes del Admin shell y de los sitios públicos que pueden llamar con credenciales. */
  corsOrigins: readonly string[];
  /** Cuota por IP como defensa en profundidad; el WAF del gateway es la primera barrera. */
  rateLimitPerMinute?: number;
  trustProxy?: boolean;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Valores que nunca deben aparecer en logs. */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const loggerOptions: FastifyServerOptions['logger'] = {
    level: options.logLevel ?? 'info',
    redact: REDACTED_PATHS,
    base: { service: options.serviceName },
    serializers: {
      // La URL se redacta: puede llevar el token de una invitación, de una vista previa o el `code` OIDC.
      req: (request) => ({
        method: request.method,
        url: redactUrl(request.url ?? ''),
        host: request.headers?.host,
        remoteAddress: request.ip,
      }),
    },
  };

  const app = Fastify({
    logger: loggerOptions,
    trustProxy: options.trustProxy ?? false,
    bodyLimit: 1024 * 1024,
    // Un hostname válido mide hasta 253 caracteres; el esquema es quien lo rechaza con 400.
    routerOptions: { maxParamLength: 512 },
    // Solo se acepta un X-Request-Id con formato válido; si no, se genera uno (evita log forging).
    requestIdHeader: false,
    genReqId: (request) => {
      const supplied = request.headers['x-request-id'];
      const value = Array.isArray(supplied) ? supplied[0] : supplied;
      return value && REQUEST_ID.test(value) ? value : uuidV7Generator.next();
    },
    ajv: {
      customOptions: {
        // Un campo desconocido se rechaza en lugar de eliminarse en silencio.
        removeAdditional: false,
        coerceTypes: 'array',
        allErrors: true,
        strict: false,
      },
    },
  });

  app.addContentTypeParser(
    'application/merge-patch+json',
    { parseAs: 'string' },
    (_request, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(Object.assign(new Error('JSON no válido'), { statusCode: 400 }), undefined);
      }
    },
  );

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: [...options.corsOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'idempotency-key',
      'if-match',
      'x-csrf-token',
      'x-request-id',
    ],
    exposedHeaders: ['etag', 'location', 'retry-after', 'x-request-id'],
  });
  await app.register(rateLimit, { max: options.rateLimitPerMinute ?? 600, timeWindow: '1 minute' });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  app.addHook('onRequest', createAuthHook(options.authenticators));

  installErrorHandling(app);
  return app;
}
