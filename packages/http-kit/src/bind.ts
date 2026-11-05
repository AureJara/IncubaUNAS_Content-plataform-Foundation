import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiOperation } from './spec.js';

export type OperationHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

export class ContractBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractBindingError';
  }
}

/**
 * Registra una ruta por cada operación del OpenAPI. El contrato manda en las dos direcciones: si
 * falta un handler para una operación, o hay un handler que el contrato no declara, el servicio no
 * arranca. Así el código no puede divergir del OpenAPI sin que se note.
 */
export function bindOperations(
  app: FastifyInstance,
  operations: readonly ApiOperation[],
  handlers: Readonly<Record<string, OperationHandler>>,
): void {
  const declared = new Set(operations.map((o) => o.operationId));
  const missing = [...declared].filter((id) => !(id in handlers));
  const undeclared = Object.keys(handlers).filter((id) => !declared.has(id));
  if (missing.length || undeclared.length) {
    throw new ContractBindingError(
      [
        missing.length ? `Operaciones sin handler: ${missing.join(', ')}` : '',
        undeclared.length ? `Handlers que el contrato no declara: ${undeclared.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. '),
    );
  }

  for (const operation of operations) {
    const handler = handlers[operation.operationId]!;
    app.route({
      method: operation.method,
      url: operation.url,
      schema: Object.fromEntries(
        Object.entries(operation.schema).filter(([, v]) => v !== undefined),
      ),
      config: { operationId: operation.operationId, security: operation.security },
      handler: async (request, reply) => {
        const result = await handler(request, reply);
        // Si el handler ya respondió (redirect, 204 con cookies…), no se envía de nuevo.
        return reply.sent ? reply : result;
      },
    });
  }
}
