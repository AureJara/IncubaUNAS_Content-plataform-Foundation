import type { Uuid } from '@incubaunas/shared-kernel';
import type { Authorization } from './authorization.js';

export interface Actor {
  type: 'user' | 'service' | 'system';
  id: string;
}

/**
 * Contexto firmado de una petición. Se construye solo a partir de la sesión o del token validado:
 * ni el cuerpo ni los headers del navegador pueden decidir el tenant o el actor.
 */
export interface RequestContext {
  requestId: string;
  /** `null` cuando el actor aún no eligió una organización o actúa a nivel plataforma. */
  organizationId: Uuid | null;
  actor: Actor;
  /** Presente cuando el actor es una persona. */
  userId?: Uuid;
  sessionId?: Uuid;
  authz: Authorization;
}

/** Exige contexto de organización y devuelve su id (los comandos tenant-scoped lo necesitan). */
export function requireOrganization(context: RequestContext): Uuid {
  if (context.organizationId === null) {
    throw new Error('El comando exige una organización activa en el contexto.');
  }
  return context.organizationId;
}
