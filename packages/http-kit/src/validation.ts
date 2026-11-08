import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { JsonSchema } from './contract.ts';
import type { ProblemFieldError } from './problem.ts';

// ajv-formats publica CommonJS con `exports.default`.
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

export type Validator = (data: unknown) => ProblemFieldError[];

function createAjv(coerceTypes: boolean): Ajv2020 {
  const ajv = new Ajv2020({
    // Palabras clave desconocidas y números raros son error; `strictTypes`/`strictRequired` rechazarían composiciones
    // válidas del contrato (`allOf` + `unevaluatedProperties`, `required` dentro de `if`).
    strictSchema: true,
    strictNumbers: true,
    strictTypes: false,
    strictTuples: false,
    strictRequired: false,
    allErrors: true,
    allowUnionTypes: true,
    discriminator: true,
    coerceTypes: coerceTypes ? 'array' : false,
    useDefaults: coerceTypes,
  });
  addFormats(ajv);
  // Palabras de OpenAPI que no son de JSON Schema.
  ajv.addVocabulary(['example', 'xml', 'externalDocs']);
  return ajv;
}

const NOT_ALLOWED = 'propiedad no permitida por el contrato';

function toFieldError(error: ErrorObject, prefix: string): ProblemFieldError {
  const params = error.params as Record<string, unknown>;
  const base = `${prefix}${error.instancePath}`;
  const extra = (key: string) => (typeof params[key] === 'string' ? `/${params[key]}` : '');
  switch (error.keyword) {
    case 'required':
      return { pointer: base + extra('missingProperty'), detail: 'es obligatorio' };
    case 'additionalProperties':
      return { pointer: base + extra('additionalProperty'), detail: NOT_ALLOWED };
    case 'unevaluatedProperties':
      return { pointer: base + extra('unevaluatedProperty'), detail: NOT_ALLOWED };
    default:
      return { pointer: base === '' ? '/' : base, detail: error.message ?? 'no cumple el contrato' };
  }
}

/**
 * Compila los schemas del contrato con Ajv (JSON Schema 2020-12). Hay dos instancias: los parámetros convierten
 * tipos (la query llega como texto); los cuerpos y las respuestas no.
 */
export class SchemaCompiler {
  readonly #strict = createAjv(false);
  readonly #coercing = createAjv(true);

  /** Valida un cuerpo o una respuesta tal cual. */
  body(schema: JsonSchema, prefix = ''): Validator {
    return this.#wrap(this.#strict.compile(schema as object), prefix);
  }

  /** Valida parámetros convirtiendo tipos y aplicando `default`. */
  parameters(schema: JsonSchema, prefix: string): Validator {
    return this.#wrap(this.#coercing.compile(schema as object), prefix);
  }

  #wrap(validate: ValidateFunction, prefix: string): Validator {
    return (data) => (validate(data) ? [] : (validate.errors ?? []).map((e) => toFieldError(e, prefix)));
  }
}
