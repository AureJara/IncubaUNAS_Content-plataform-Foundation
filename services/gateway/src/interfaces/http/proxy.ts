import replyFrom from '@fastify/reply-from';
import type { Audience, TokenSigner } from '@incuba/authz';
import { HttpProblem, sendProblem, unauthorized } from '@incuba/http-kit';
import type { FastifyInstance } from 'fastify';
import type { SessionResolver } from '../../application/ports.ts';

export interface Upstream {
  /** Ruta de Fastify que se reenvía, por ejemplo `/platform/v1/*`. */
  route: string;
  target: URL;
  /** Audiencia del token interno que se adjunta; sin ella el request va sin token. */
  audience?: Audience;
  /** `required`: sin sesión → 401. `optional`: con sesión se adjunta el token. */
  session: 'required' | 'optional' | 'none';
}

/** Headers del navegador que nunca llegan a los servicios: la cookie de sesión y cualquier token que traiga. */
const STRIPPED = new Set(['cookie', 'authorization', 'host', 'x-csrf-token']);

/**
 * Proxy del gateway (spec 3.6): reenvía el request tal cual (sin parsear el cuerpo), quita la cookie y adjunta un
 * token interno firmado para la audiencia del servicio destino, con el mismo request ID.
 */
export async function registerProxy(
  app: FastifyInstance,
  input: { upstreams: readonly Upstream[]; resolveSession: SessionResolver; sign: TokenSigner },
): Promise<void> {
  await app.register(async (scope) => {
    // El cuerpo pasa como stream al servicio, que lo valida contra su contrato.
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_request, payload, done) => done(null, payload));
    await scope.register(replyFrom, { undici: { connections: 64, pipelining: 1 } });

    for (const upstream of input.upstreams) {
      scope.all(upstream.route, async (request, reply) => {
        let token: string | undefined;
        if (upstream.session !== 'none') {
          const session = await input.resolveSession(request);
          if (session === undefined && upstream.session === 'required') throw unauthorized();
          if (session !== undefined && upstream.audience !== undefined) {
            token = await input.sign(session, upstream.audience);
          }
        }
        return reply.from(new URL(request.url, upstream.target).toString(), {
          rewriteRequestHeaders: (_original, headers) => {
            const forwarded: Record<string, string | string[] | undefined> = {};
            for (const [name, value] of Object.entries(headers)) {
              if (!STRIPPED.has(name.toLowerCase())) forwarded[name] = value;
            }
            forwarded['x-request-id'] = String(request.id);
            if (token !== undefined) forwarded['authorization'] = `Bearer ${token}`;
            return forwarded;
          },
          onError: (errorReply, { error }) => {
            request.log.warn({ err: error, upstream: upstream.target.origin }, 'servicio no disponible');
            return sendProblem(
              errorReply,
              new HttpProblem({
                status: 503,
                code: 'service_unavailable',
                detail: 'El servicio no responde. Intenta de nuevo en unos segundos.',
                headers: { 'retry-after': '5' },
              }),
            );
          },
        });
      });
    }
  });
}
