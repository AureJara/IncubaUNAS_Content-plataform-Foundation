/**
 * Error de dominio con un código estable del catálogo (spec 9.7). La capa `interfaces/http` lo traduce a Problem
 * Details; el dominio no sabe de HTTP.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

/** Transición que no está en la máquina de estados (RN-21). */
export class InvalidStateTransitionError extends DomainError {
  constructor(aggregate: string, from: string, to: string) {
    super('invalid_state_transition', `${aggregate}: ${from} → ${to} no está permitida`, { aggregate, from, to });
    this.name = 'InvalidStateTransitionError';
  }
}
