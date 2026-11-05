import type { Uuid } from '@incubaunas/shared-kernel';
import type { DbClient, Pool } from './pool.js';

export interface TenantScope {
  /** Organización activa; las políticas RLS la leen con `app_current_organization()`. */
  organizationId?: Uuid | null;
  /** Persona que actúa; permite consultas "mis organizaciones" sin salirse del tenant. */
  userId?: Uuid | null;
}

/** Ejecuta `work` en una transacción: confirma si termina bien y revierte si lanza. */
export async function withTransaction<T>(
  pool: Pool,
  work: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Igual que {@link withTransaction} pero fija el tenant con `set_config(..., true)`, que equivale a
 * `SET LOCAL`: el valor desaparece al terminar la transacción y nunca contamina a la siguiente
 * petición que reutilice la conexión.
 */
export function withTenant<T>(
  pool: Pool,
  scope: TenantScope,
  work: (client: DbClient) => Promise<T>,
): Promise<T> {
  return withTransaction(pool, async (client) => {
    await client.query(
      `select set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true)`,
      [scope.organizationId ?? '', scope.userId ?? ''],
    );
    return work(client);
  });
}
