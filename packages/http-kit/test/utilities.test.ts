import { describe, expect, it } from 'vitest';
import {
  assertIfMatch,
  ConfigError,
  decodeCursor,
  env,
  loadConfig,
  paginate,
  preferredExample,
  redactUrl,
  requestHash,
} from '../src/index.ts';

describe('If-Match (spec 9.1)', () => {
  it('falta → 428; no coincide → 412; coincide → pasa', () => {
    expect(() => assertIfMatch(undefined, 3)).toThrow(expect.objectContaining({ status: 428 }));
    expect(() => assertIfMatch('"r2"', 3)).toThrow(expect.objectContaining({ status: 412, code: 'stale_revision' }));
    expect(() => assertIfMatch('W/"r3"', 3)).toThrow(expect.objectContaining({ status: 412 }));
    expect(() => assertIfMatch('"r3"', 3)).not.toThrow();
  });
});

describe('cursores', () => {
  it('pagina con cursor opaco hasta el final', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const first = paginate(items, (x) => x, 2);
    expect(first.items).toEqual(['a', 'b']);
    const second = paginate(items, (x) => x, 2, first.next_cursor ?? undefined);
    expect(second.items).toEqual(['c', 'd']);
    const last = paginate(items, (x) => x, 2, second.next_cursor ?? undefined);
    expect(last).toEqual({ items: ['e'], next_cursor: null });
  });

  it('un cursor mal formado es 400 con pointer', () => {
    expect(() => decodeCursor('%%%')).toThrow(expect.objectContaining({ status: 400, code: 'bad_request' }));
  });
});

describe('idempotencia', () => {
  it('el hash no depende del orden de las claves', () => {
    expect(requestHash({ a: 1, b: { c: 2, d: 3 } })).toBe(requestHash({ b: { d: 3, c: 2 }, a: 1 }));
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
  });
});

describe('Prefer', () => {
  it('lee el nombre del ejemplo', () => {
    expect(preferredExample('example=not_found')).toBe('not_found');
    expect(preferredExample('return=minimal, example="stale"')).toBe('stale');
    expect(preferredExample(undefined)).toBeUndefined();
  });
});

describe('logs', () => {
  it('no deja tokens de invitación, vista previa ni del callback', () => {
    expect(redactUrl('/public/v1/invitations/abc123/acceptance')).toBe('/public/v1/invitations/[redacted]/acceptance');
    expect(redactUrl('/public/v1/previews/xyz')).toBe('/public/v1/previews/[redacted]');
    expect(redactUrl('/auth/callback?code=c1&state=s1')).toBe('/auth/callback?code=[redacted]&state=[redacted]');
  });
});

describe('configuración (PF-051)', () => {
  it('junta todos los errores antes de fallar', () => {
    const read = () =>
      loadConfig<{ port: number; url: URL; mode: 'a' | 'b' }>(
        { PORT: '99999', MODE: 'c' },
        { port: ['PORT', env.port()], url: ['URL', env.url()], mode: ['MODE', env.oneOf(['a', 'b'] as const)] },
      );
    expect(read).toThrow(ConfigError);
    try {
      read();
    } catch (error) {
      expect((error as ConfigError).problems).toHaveLength(3);
    }
  });
});
