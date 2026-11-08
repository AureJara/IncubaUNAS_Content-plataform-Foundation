const VALID_REQUEST_ID = /^[A-Za-z0-9-]{8,128}$/;

/** `X-Request-Id` se acepta si es válido; si no, se genera uno nuevo (spec 9.1). */
export function acceptRequestId(header: unknown, generate: () => string): string {
  return typeof header === 'string' && VALID_REQUEST_ID.test(header) ? header : generate();
}
