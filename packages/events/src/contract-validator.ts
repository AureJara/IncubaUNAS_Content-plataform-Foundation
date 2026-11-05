import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020, addFormats, type ValidateFunction } from './ajv.js';

const SCHEMA_BASE = 'https://schemas.incubaunas.dev/';
const DEFAULT_DIRECTORY = fileURLToPath(new URL('../../../contracts/schemas/', import.meta.url));

export class ContractViolationError extends Error {
  constructor(
    readonly topic: string,
    readonly details: string,
  ) {
    super(`El mensaje ${topic} no cumple su contrato: ${details}`);
    this.name = 'ContractViolationError';
  }
}

function listJson(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? listJson(full) : entry.endsWith('.json') ? [full] : [];
  });
}

/**
 * Valida un mensaje contra el JSON Schema de su topic (los mismos archivos que el gate de contratos).
 * Un topic sin schema se rechaza: no se publica nada que no esté en el contrato.
 */
export class EventContractValidator {
  private readonly ajv = new Ajv2020({ strict: true, allErrors: true });
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(directory: string = process.env.CONTRACT_SCHEMAS_DIR ?? DEFAULT_DIRECTORY) {
    addFormats(this.ajv);
    for (const file of listJson(directory)) {
      const key = SCHEMA_BASE + relative(directory, file).split(sep).join('/');
      this.ajv.addSchema(JSON.parse(readFileSync(file, 'utf8')), key);
    }
    for (const file of listJson(join(directory, 'events'))) {
      const topic = file
        .split(sep)
        .pop()!
        .replace(/\.json$/, '');
      const validate = this.ajv.getSchema(`${SCHEMA_BASE}events/${topic}.json`);
      if (validate) this.validators.set(topic, validate);
    }
  }

  knows(topic: string): boolean {
    return this.validators.has(topic);
  }

  assertValid(message: object): void {
    const rawTopic = (message as { topic?: unknown }).topic;
    const topic = typeof rawTopic === 'string' ? rawTopic : '(sin topic)';
    const validate = this.validators.get(topic);
    if (!validate)
      throw new ContractViolationError(
        topic,
        'el topic no tiene schema en contracts/schemas/events',
      );
    if (!validate(message))
      throw new ContractViolationError(topic, this.ajv.errorsText(validate.errors));
  }
}
