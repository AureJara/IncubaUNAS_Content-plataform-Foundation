import { Ajv2020, addFormats } from './ajv.js';
import type { ApiOperation } from './spec.js';

/** Códigos transversales que cualquier operación puede devolver (ver common.v1.yaml). */
const TRANSVERSAL_STATUSES = new Set([400, 401, 403, 404, 429]);

/**
 * Verifica que una respuesta real cumple el OpenAPI: el código está declarado y el cuerpo valida
 * contra el esquema de ese código. Se usa en las pruebas de contrato de cada servicio.
 */
export function createConformanceChecker(operations: readonly ApiOperation[]) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const byId = new Map(operations.map((o) => [o.operationId, o]));

  return function assertConforms(
    operationId: string,
    status: number,
    mediaType: string,
    body: unknown,
  ): void {
    const operation = byId.get(operationId);
    if (!operation) throw new Error(`Operación desconocida: ${operationId}`);

    const declared = operation.responseStatuses.includes(String(status));
    if (!declared && !TRANSVERSAL_STATUSES.has(status)) {
      throw new Error(`${operationId}: el código ${status} no está declarado en el contrato`);
    }
    if (status === 204 || status === 302 || status === 304) return;

    const schema = operation.responses[String(status)]?.[mediaType.split(';')[0]!.trim()];
    if (!schema) return; // código transversal sin cuerpo declarado aquí
    const validate = ajv.compile(schema);
    if (!validate(body)) {
      throw new Error(
        `${operationId} ${status}: la respuesta no cumple el contrato → ${ajv.errorsText(validate.errors)}`,
      );
    }
  };
}
