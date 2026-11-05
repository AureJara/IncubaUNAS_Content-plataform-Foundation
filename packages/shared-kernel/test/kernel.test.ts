import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  AppError,
  ERROR_CODES,
  canonicalize,
  contentHash,
  etagFor,
  isUuid,
  parseIfMatch,
  toProblem,
  uuidV7Generator,
} from '../src/index.js';

describe('contrato de códigos de error', () => {
  it('coincide con el enum ErrorCode de common.v1.yaml', () => {
    const common = parse(
      readFileSync(new URL('../../../contracts/openapi/common.v1.yaml', import.meta.url), 'utf8'),
    );
    expect([...ERROR_CODES].sort()).toEqual([...common.components.schemas.ErrorCode.enum].sort());
  });
});

describe('ids', () => {
  it('genera UUIDv7 ordenables por tiempo', () => {
    const first = uuidV7Generator.next();
    const second = uuidV7Generator.next();
    expect(isUuid(first)).toBe(true);
    expect(first[14]).toBe('7');
    expect(first < second || first.slice(0, 13) === second.slice(0, 13)).toBe(true);
  });
});

describe('hash de contenido', () => {
  it('no depende del orden de las claves', () => {
    expect(contentHash({ b: 1, a: [1, { y: 2, x: 1 }] })).toBe(
      contentHash({ a: [1, { x: 1, y: 2 }], b: 1 }),
    );
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it('cambia si cambia el contenido y respeta el formato del contrato', () => {
    expect(contentHash({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});

describe('If-Match', () => {
  it('lee la revisión de un ETag fuerte o débil', () => {
    expect(parseIfMatch(etagFor(7))).toBe(7);
    expect(parseIfMatch('W/"3"')).toBe(3);
  });

  it('rechaza valores ausentes o mal formados', () => {
    expect(() => parseIfMatch(undefined)).toThrow(AppError);
    expect(() => parseIfMatch('abc')).toThrow(AppError);
  });
});

describe('Problem Details', () => {
  it('incluye código estable, request_id y errores por pointer', () => {
    const problem = toProblem(
      new AppError('validation_failed', 422, 'inválido', [
        { pointer: '/slug', code: 'pattern', message: 'slug inválido' },
      ]),
      'req-1',
    );
    expect(problem).toMatchObject({
      status: 422,
      code: 'validation_failed',
      request_id: 'req-1',
      errors: [{ pointer: '/slug' }],
    });
  });
});
