import { z } from 'zod';
import { ROLES, SCOPES } from './scopes.js';

const uuid = z.string().uuid();

/** Claims internos (AUTH-AND-AUTHORIZATION-CONTRACT.md → "Claims internos"). */
export const claimsSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1).optional(),
  /** Identificador interno de la persona; lo añade el gateway cuando el origen es una sesión. */
  user_id: uuid.optional(),
  organization_id: uuid.optional(),
  membership_id: uuid.optional(),
  roles: z.array(z.enum(ROLES)).default([]),
  scopes: z.array(z.enum(SCOPES)).default([]),
  aud: z.union([z.string(), z.array(z.string())]),
  amr: z.array(z.string()).default([]),
  auth_time: z.number().int().positive().optional(),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type AuthClaims = z.infer<typeof claimsSchema>;

export const isServiceSubject = (sub: string): boolean => sub.startsWith('service:');
