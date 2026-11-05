import { AppError, validationFailed, type Uuid } from '@incubaunas/shared-kernel';
import { assertRoles } from './membership.js';
import type { Role } from '@incubaunas/tenancy';

export type InvitationState = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export const MAX_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface InvitationSnapshot {
  id: Uuid;
  organizationId: Uuid;
  /** Datos protegidos: el dominio nunca ve el correo en claro. */
  emailCiphertext: string;
  emailBlindIndex: string;
  roles: Role[];
  tokenHash: string;
  state: InvitationState;
  expiresAt: Date;
  acceptedBy: Uuid | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Invitation {
  private constructor(private props: InvitationSnapshot) {}

  static issue(
    input: {
      id: Uuid;
      organizationId: Uuid;
      emailCiphertext: string;
      emailBlindIndex: string;
      roles: readonly string[];
      tokenHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): Invitation {
    const ttl = input.expiresAt.getTime() - now.getTime();
    if (ttl <= 0 || ttl > MAX_INVITATION_TTL_MS) {
      throw validationFailed('La vigencia de la invitación no es válida.', [
        {
          pointer: '/expires_at',
          code: 'range',
          message: 'Debe ser futura y de 7 días como máximo.',
        },
      ]);
    }
    return new Invitation({
      id: input.id,
      organizationId: input.organizationId,
      emailCiphertext: input.emailCiphertext,
      emailBlindIndex: input.emailBlindIndex,
      roles: assertRoles(input.roles),
      tokenHash: input.tokenHash,
      state: 'pending',
      expiresAt: input.expiresAt,
      acceptedBy: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: InvitationSnapshot): Invitation {
    return new Invitation({ ...snapshot, roles: [...snapshot.roles] });
  }

  get snapshot(): InvitationSnapshot {
    return { ...this.props, roles: [...this.props.roles] };
  }

  get state(): InvitationState {
    return this.props.state;
  }

  get revision(): number {
    return this.props.revision;
  }

  /** Solo la persona invitada puede aceptar: se compara el correo verificado contra el invitado. */
  accept(by: { userId: Uuid; emailBlindIndex: string | null }, now: Date): void {
    this.assertUsable(now);
    if (by.emailBlindIndex !== this.props.emailBlindIndex) {
      // Misma respuesta que un token inexistente: no se revela a quién se invitó.
      throw new AppError('not_found', 404, 'La invitación no existe o no está disponible.');
    }
    this.props.state = 'accepted';
    this.props.acceptedBy = by.userId;
    this.props.updatedAt = now;
  }

  decline(now: Date): void {
    this.assertUsable(now);
    this.props.state = 'declined';
    this.props.updatedAt = now;
  }

  private assertUsable(now: Date): void {
    if (this.props.state !== 'pending') {
      throw new AppError('invitation_not_pending', 409, 'La invitación ya no está pendiente.');
    }
    if (this.props.expiresAt.getTime() <= now.getTime()) {
      throw new AppError('invitation_expired', 409, 'La invitación expiró.');
    }
  }
}
