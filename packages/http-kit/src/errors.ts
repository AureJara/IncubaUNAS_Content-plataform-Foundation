import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, internalProblem, toProblem, type FieldError } from '@incubaunas/shared-kernel';

interface AjvIssue {
  instancePath?: string;
  keyword?: string;
  message?: string;
  params?: { missingProperty?: string; additionalProperty?: string };
}

/** Convierte los errores de Ajv en `errors[]` con JSON Pointer, sin eco de valores del cliente. */
export function toFieldErrors(issues: readonly AjvIssue[], context: string): FieldError[] {
  return issues.map((issue) => {
    const base = issue.instancePath ?? '';
    const extra = issue.params?.missingProperty ?? issue.params?.additionalProperty;
    const tail = extra ? `/${extra}` : '';
    const prefix = context === 'body' ? '' : `#/${context}`;
    return {
      pointer: `${prefix}${base}${tail}` || '/',
      code: issue.keyword ?? 'invalid',
      message: issue.message ?? 'Valor no válido.',
    };
  });
}

const sendProblem = (reply: FastifyReply, error: AppError, requestId: string) => {
  for (const [name, value] of Object.entries(error.headers)) reply.header(name, value);
  return reply
    .status(error.status)
    .type('application/problem+json')
    .send(toProblem(error, requestId));
};

/** Traduce cualquier error a Problem Details. Los fallos inesperados nunca filtran detalles. */
export function installErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;

    if (error instanceof AppError) return sendProblem(reply, error, requestId);

    if (error.validation) {
      const context = error.validationContext ?? 'body';
      const missingKey =
        context === 'headers' && JSON.stringify(error.validation).includes('idempotency-key');
      return sendProblem(
        reply,
        new AppError(
          missingKey ? 'idempotency_key_required' : 'validation_failed',
          400,
          'La petición no cumple el contrato.',
          toFieldErrors(error.validation, context),
        ),
        requestId,
      );
    }

    if (error.statusCode === 429) {
      return sendProblem(
        reply,
        new AppError('rate_limited', 429, 'Demasiadas peticiones.', [], {
          'retry-after': String(Math.ceil(Number(reply.getHeader('retry-after') ?? 1))),
        }),
        requestId,
      );
    }

    if (error.statusCode && [400, 413, 414, 415].includes(error.statusCode)) {
      return sendProblem(
        reply,
        new AppError('validation_failed', error.statusCode, 'La petición no se puede procesar.'),
        requestId,
      );
    }

    request.log.error({ err: error }, 'error inesperado');
    return reply.status(500).type('application/problem+json').send(internalProblem(requestId));
  });

  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, new AppError('not_found', 404, 'La ruta no existe.'), request.id),
  );
}
