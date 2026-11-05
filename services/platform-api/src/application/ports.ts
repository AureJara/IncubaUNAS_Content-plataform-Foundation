import type { Uuid } from '@incubaunas/shared-kernel';
import type { AuditLog, IdempotencyStore, StoredResponse } from '@incubaunas/service-kit';
import type { OutboxWriter } from '@incubaunas/events';
import type { Role } from '@incubaunas/tenancy';
import type { Invitation } from '../domain/invitation.js';
import type { Membership, MembershipSnapshot, MembershipState } from '../domain/membership.js';
import type { Organization, OrganizationSnapshot } from '../domain/organization.js';

/** Lo que el almacén necesita para fijar el tenant de la transacción. */
export interface TenantScope {
  organizationId?: Uuid | null;
  userId?: Uuid | null;
}

export interface Keyset {
  createdAt: string;
  id: string;
}

// ---------------------------------------------------------------- usuarios
export interface UserRecord {
  id: Uuid;
  displayName: string | null;
  emailCiphertext: string | null;
  emailBlindIndex: string | null;
}

export interface NewUser extends UserRecord {
  issuer: string;
  subject: string;
}

export interface UserRepository {
  findByIdentity(issuer: string, subject: string): Promise<UserRecord | null>;
  findById(id: Uuid): Promise<UserRecord | null>;
  findByEmailBlindIndex(blindIndex: string): Promise<UserRecord | null>;
  insert(user: NewUser, now: Date): Promise<void>;
  updateProfile(id: Uuid, profile: Omit<UserRecord, 'id'>, now: Date): Promise<void>;
}

// ---------------------------------------------------------------- organizaciones y membresías
export interface OrganizationRepository {
  insert(org: Organization, actorUserId: Uuid | null): Promise<void>;
  findById(id: Uuid): Promise<Organization | null>;
  /** Actualiza con bloqueo optimista y devuelve la organización con su revisión nueva. */
  update(
    org: Organization,
    expectedRevision: number,
    actorUserId: Uuid | null,
  ): Promise<Organization>;
}

export interface MemberView {
  membership: MembershipSnapshot;
  displayName: string | null;
  emailCiphertext: string | null;
}

export interface OrganizationMembershipView {
  organization: OrganizationSnapshot;
  roles: Role[];
}

export interface MembershipRepository {
  insert(membership: Membership, actorUserId: Uuid | null): Promise<void>;
  findById(organizationId: Uuid, id: Uuid): Promise<Membership | null>;
  /** La membresía vigente (no revocada ni vencida) de la persona en la organización. */
  findCurrentForUser(organizationId: Uuid, userId: Uuid): Promise<Membership | null>;
  update(
    membership: Membership,
    expectedRevision: number,
    actorUserId: Uuid | null,
  ): Promise<Membership>;
  /** Devuelve hasta `limit` filas; el llamador pide `limit + 1` para saber si hay otra página. */
  list(
    organizationId: Uuid,
    filter: { state?: MembershipState; role?: Role },
    limit: number,
    after: Keyset | null,
  ): Promise<MemberView[]>;
  countActiveOwners(organizationId: Uuid): Promise<number>;
  listActiveForUser(userId: Uuid): Promise<OrganizationMembershipView[]>;
}

// ---------------------------------------------------------------- invitaciones
export interface InvitationRepository {
  insert(invitation: Invitation, actorUserId: Uuid | null): Promise<void>;
  findByTokenHash(organizationId: Uuid, tokenHash: string): Promise<Invitation | null>;
  update(invitation: Invitation, expectedRevision: number): Promise<Invitation>;
}

// ---------------------------------------------------------------- sesiones
export interface SessionRecord {
  id: Uuid;
  userId: Uuid;
  organizationId: Uuid | null;
  secretHash: string;
  previousSecretHash: string | null;
  deviceLabel: string | null;
  ipPseudonym: string | null;
  authTime: Date;
  amr: string[];
  createdAt: Date;
  lastUsedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionRepository {
  insert(session: SessionRecord): Promise<void>;
  findById(id: Uuid): Promise<SessionRecord | null>;
  touch(id: Uuid, lastUsedAt: Date, idleExpiresAt: Date): Promise<void>;
  rotate(
    id: Uuid,
    newSecretHash: string,
    previousSecretHash: string,
    now: Date,
    idleExpiresAt: Date,
  ): Promise<void>;
  setOrganization(
    id: Uuid,
    organizationId: Uuid | null,
    newSecretHash: string,
    previousSecretHash: string,
  ): Promise<void>;
  revoke(id: Uuid, now: Date, reason: string): Promise<void>;
  revokeAllForUser(userId: Uuid, now: Date, reason: string): Promise<number>;
  revokeForUserInOrganization(
    userId: Uuid,
    organizationId: Uuid,
    now: Date,
    reason: string,
  ): Promise<number>;
  revokeAllInOrganization(organizationId: Uuid, now: Date, reason: string): Promise<number>;
  listActiveForUser(userId: Uuid, now: Date): Promise<SessionRecord[]>;
}

export interface LoginAttempt {
  id: Uuid;
  attemptHash: string;
  state: string;
  nonce: string;
  codeVerifierCiphertext: string;
  returnTo: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface LoginAttemptRepository {
  insert(attempt: LoginAttempt): Promise<void>;
  /** Lee y borra en un solo paso: un intento de login se usa una única vez. */
  consume(attemptHash: string, now: Date): Promise<LoginAttempt | null>;
}

// ---------------------------------------------------------------- auditoría e idempotencia
// Los contratos de auditoría e idempotencia son comunes a todos los servicios (service-kit).
export type {
  AuditEntry,
  AuditLog,
  AuditRow,
  IdempotencyScope,
  IdempotencyStore,
  StoredResponse,
} from '@incubaunas/service-kit';

export interface BootstrapStore {
  find(actorId: string, key: string): Promise<(StoredResponse & { organizationId: Uuid }) | null>;
  save(
    actorId: string,
    key: string,
    organizationId: Uuid,
    stored: StoredResponse,
    now: Date,
  ): Promise<void>;
}

// ---------------------------------------------------------------- cuentas de servicio y dominios
export interface ServiceAccountRecord {
  id: Uuid;
  organizationId: Uuid;
  name: string;
  authMethod: 'client_secret' | 'private_key_jwt';
  scopes: string[];
  audiences: string[];
  state: 'active' | 'revoked';
  expiresAt: Date;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceCredentialRecord {
  id: Uuid;
  serviceAccountId: Uuid;
  organizationId: Uuid;
  secretHash: string | null;
  publicJwk: Record<string, unknown> | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface ServiceAccountRepository {
  insert(account: ServiceAccountRecord, createdBy: Uuid | null): Promise<void>;
  findById(organizationId: Uuid, id: Uuid): Promise<ServiceAccountRecord | null>;
  insertCredential(credential: ServiceCredentialRecord): Promise<void>;
  /** Deja las credenciales vigentes con un vencimiento corto: el solapamiento de la rotación. */
  shortenActiveCredentials(serviceAccountId: Uuid, until: Date, except: Uuid): Promise<void>;
  revoke(organizationId: Uuid, id: Uuid, now: Date): Promise<ServiceAccountRecord | null>;
}

export type DomainState = 'pending' | 'verifying' | 'active' | 'failed' | 'suspended' | 'released';

export interface DomainRecord {
  id: Uuid;
  organizationId: Uuid;
  siteId: Uuid;
  hostname: string;
  state: DomainState;
  isPrimary: boolean;
  challenge: { method: 'dns_txt' | 'http_file'; name: string; value: string };
  activatedAt: Date | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DomainRepository {
  insert(domain: DomainRecord, createdBy: Uuid | null): Promise<void>;
  findById(organizationId: Uuid, id: Uuid): Promise<DomainRecord | null>;
  setState(
    domain: DomainRecord,
    expectedRevision: number,
    next: DomainState,
    now: Date,
  ): Promise<DomainRecord>;
}

export interface HostRoute {
  hostname: string;
  siteId: Uuid;
  organizationId: Uuid;
}

export interface HostRouteRepository {
  upsert(route: HostRoute, now: Date): Promise<void>;
  find(hostname: string): Promise<HostRoute | null>;
}

/** Comprueba, fuera de la transacción, que quien registró el dominio controla el hostname. */
export interface DomainVerifier {
  verify(domain: Pick<DomainRecord, 'hostname' | 'challenge'>): Promise<boolean>;
}

// ---------------------------------------------------------------- identidad federada
export interface IdentityClaims {
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  amr: string[];
  authTime: Date | null;
}

export interface OidcProvider {
  /** Genera state, nonce y PKCE, y la URL de autorización del proveedor. */
  createAuthorization(params: { redirectUri: string }): Promise<{
    url: string;
    state: string;
    nonce: string;
    codeVerifier: string;
  }>;
  /** Valida el callback (state, nonce, emisor, audiencia, firma, PKCE) y devuelve la identidad. */
  completeAuthorization(params: {
    callbackUrl: URL;
    expectedState: string;
    nonce: string;
    codeVerifier: string;
  }): Promise<IdentityClaims>;
}

// ---------------------------------------------------------------- composición
export interface Repositories {
  serviceAccounts: ServiceAccountRepository;
  domains: DomainRepository;
  hostRoutes: HostRouteRepository;
  users: UserRepository;
  organizations: OrganizationRepository;
  memberships: MembershipRepository;
  invitations: InvitationRepository;
  sessions: SessionRepository;
  loginAttempts: LoginAttemptRepository;
  audit: AuditLog;
  idempotency: IdempotencyStore;
  bootstrap: BootstrapStore;
  outbox: OutboxWriter;
}

/** Límite transaccional: todo lo que ocurre dentro de `run` se confirma junto o no se confirma. */
export interface UnitOfWork {
  run<T>(scope: TenantScope, work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------- servicios externos
export interface PiiProtector {
  encrypt(plain: string): string;
  decrypt(ciphertext: string): string;
  /** HMAC determinista para buscar y deduplicar sin guardar el valor en claro. */
  blindIndex(normalized: string): string;
}

export interface TokenGenerator {
  generate(): string;
}

export interface InvitationMessage {
  to: string;
  organizationName: string;
  locale: string;
  acceptUrl: string;
  expiresAt: Date;
}

export interface InvitationNotifier {
  send(message: InvitationMessage): Promise<void>;
}
