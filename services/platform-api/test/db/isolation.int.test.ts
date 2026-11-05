import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, migrate, withTenant, type Pool } from '@incubaunas/db';
import { uuidV7Generator } from '@incubaunas/shared-kernel';

const adminUrl = process.env.PLATFORM_DATABASE_ADMIN_URL;
const appUrl = process.env.PLATFORM_DATABASE_URL;
if ((!adminUrl || !appUrl) && process.env.CI)
  throw new Error('CI exige las URLs de la base de Platform');

const MIGRATIONS = new URL('../../migrations', import.meta.url);
const now = new Date();
const id = () => uuidV7Generator.next();

/** Tablas con `organization_id` que no son datos de tenant, y por qué no llevan RLS. */
const NO_RLS_ALLOWLIST: Record<string, string> = {
  sessions: 'infraestructura de autenticación: se consulta por id y secreto',
  host_routes: 'proyección pública de enrutamiento con IDs opacos',
  bootstrap_requests: 'alta de organizaciones: aún no existe tenant',
  outbox: 'mensajería: solo la usan el relay y los consumidores',
  inbox: 'mensajería: solo la usan los consumidores',
};

describe.skipIf(!adminUrl || !appUrl)(
  'aislamiento por organización (RLS contra PostgreSQL real)',
  () => {
    let pool: Pool;
    let admin: Pool;
    const orgA = id();
    const orgB = id();
    const userA = id();
    const userB = id();
    const suffix = randomUUID().slice(0, 8);

    /** Crea una organización con su owner usando solo el rol de runtime y el tenant correspondiente. */
    async function createOrganization(orgId: string, userId: string, slug: string) {
      await withTenant(pool, { organizationId: orgId, userId }, async (c) => {
        await c.query(
          `insert into users (id, display_name, created_at, updated_at) values ($1, 'U', $2, $2) on conflict do nothing`,
          [userId, now],
        );
        await c.query(
          `insert into organizations (id, slug, display_name, timezone, locale, state, created_at, updated_at)
         values ($1, $2, $3, 'America/Lima', 'es-PE', 'provisioning', $4, $4)`,
          [orgId, slug, slug, now],
        );
        const membershipId = id();
        await c.query(
          `insert into memberships (id, organization_id, user_id, state, created_at, updated_at) values ($1, $2, $3, 'active', $4, $4)`,
          [membershipId, orgId, userId, now],
        );
        await c.query(
          `insert into membership_roles (membership_id, organization_id, role) values ($1, $2, 'org_owner')`,
          [membershipId, orgId],
        );
        await c.query(`update organizations set state = 'active' where id = $1`, [orgId]);
      });
    }

    beforeAll(async () => {
      await migrate({
        connectionString: adminUrl!,
        directory: MIGRATIONS.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      });
      pool = createPool({ connectionString: appUrl!, max: 1 }); // una sola conexión: prueba el reciclaje
      admin = createPool({ connectionString: adminUrl!, max: 2 });
      await createOrganization(orgA, userA, `iso-a-${suffix}`);
      await createOrganization(orgB, userB, `iso-b-${suffix}`);
    });

    afterAll(async () => {
      await pool.end();
      await admin.end();
    });

    it('el rol de runtime no es superusuario ni evita RLS', async () => {
      const { rows } = await pool.query(
        `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
      );
      expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    });

    it('un tenant solo ve sus propias filas', async () => {
      await withTenant(pool, { organizationId: orgA }, async (c) => {
        const orgs = await c.query(`select id from organizations where slug like $1`, [
          `iso-%-${suffix}`,
        ]);
        expect(orgs.rows.map((r) => r.id)).toEqual([orgA]);

        const members = await c.query(
          `select user_id from memberships where organization_id = any($1)`,
          [[orgA, orgB]],
        );
        expect(members.rows.map((r) => r.user_id)).toEqual([userA]);

        const direct = await c.query(`select 1 from organizations where id = $1`, [orgB]);
        expect(direct.rowCount).toBe(0);
      });
    });

    it('sin tenant no se ve nada (falla cerrado)', async () => {
      const { rowCount } = await pool.query(`select 1 from organizations where slug like $1`, [
        `iso-%-${suffix}`,
      ]);
      expect(rowCount).toBe(0);
    });

    it('el tenant no se filtra a la siguiente transacción que reutiliza la conexión', async () => {
      await withTenant(pool, { organizationId: orgA }, (c) => c.query('select 1'));
      const { rows } = await pool.query(`select app_current_organization() as org`);
      expect(rows[0].org).toBeNull();
    });

    it('no se puede insertar ni modificar datos de otra organización', async () => {
      await withTenant(pool, { organizationId: orgA }, async (c) => {
        await expect(
          c.query(
            `insert into memberships (id, organization_id, user_id, state, created_at, updated_at) values ($1, $2, $3, 'active', $4, $4)`,
            [id(), orgB, userA, now],
          ),
        ).rejects.toMatchObject({ code: '42501' });
      });

      const updated = await withTenant(pool, { organizationId: orgA }, (c) =>
        c.query(`update organizations set display_name = 'hackeada' where id = $1`, [orgB]),
      );
      expect(updated.rowCount).toBe(0);
    });

    it('"mis organizaciones" lista las membresías del usuario sin cambiar de tenant', async () => {
      // userA también es miembro de B.
      await withTenant(pool, { organizationId: orgB, userId: userB }, async (c) => {
        const membershipId = id();
        await c.query(
          `insert into memberships (id, organization_id, user_id, state, created_at, updated_at) values ($1, $2, $3, 'active', $4, $4)`,
          [membershipId, orgB, userA, now],
        );
        await c.query(
          `insert into membership_roles (membership_id, organization_id, role) values ($1, $2, 'site_editor')`,
          [membershipId, orgB],
        );
      });

      await withTenant(pool, { userId: userA }, async (c) => {
        const { rows } = await c.query(
          `select id from organizations where slug like $1 order by slug`,
          [`iso-%-${suffix}`],
        );
        expect(rows.map((r) => r.id).sort()).toEqual([orgA, orgB].sort());
      });
    });

    it('no deja a la organización sin owner activo', async () => {
      await expect(
        withTenant(pool, { organizationId: orgA }, (c) =>
          c.query(
            `update memberships set state = 'revoked' where organization_id = $1 and user_id = $2`,
            [orgA, userA],
          ),
        ),
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('last_owner_required'),
      });
    });

    it('permite traspasar el rol de owner dentro de una misma transacción', async () => {
      const newOwner = id();
      await withTenant(pool, { organizationId: orgA }, async (c) => {
        await c.query(
          `insert into users (id, display_name, created_at, updated_at) values ($1, 'N', $2, $2)`,
          [newOwner, now],
        );
        const membershipId = id();
        await c.query(
          `insert into memberships (id, organization_id, user_id, state, created_at, updated_at) values ($1, $2, $3, 'active', $4, $4)`,
          [membershipId, orgA, newOwner, now],
        );
        await c.query(
          `insert into membership_roles (membership_id, organization_id, role) values ($1, $2, 'org_owner')`,
          [membershipId, orgA],
        );
        await c.query(
          `update memberships set state = 'revoked' where organization_id = $1 and user_id = $2`,
          [orgA, userA],
        );
      });
    });

    it('la auditoría es append-only para el rol de runtime', async () => {
      const auditId = id();
      await withTenant(pool, { organizationId: orgB }, (c) =>
        c.query(
          `insert into security_audit (id, organization_id, occurred_at, actor_type, actor_id, action, target_type, target_id, outcome, request_id)
         values ($1, $2, $3, 'user', 'u', 'test.action', 'organization', $4, 'success', 'req-1')`,
          [auditId, orgB, now, orgB],
        ),
      );
      await expect(
        withTenant(pool, { organizationId: orgB }, (c) =>
          c.query(`update security_audit set action = 'x' where id = $1`, [auditId]),
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        withTenant(pool, { organizationId: orgB }, (c) =>
          c.query(`delete from security_audit where id = $1`, [auditId]),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('toda tabla con organization_id tiene RLS forzada, política e índice con el tenant primero', async () => {
      const { rows: tables } = await admin.query<{
        table_name: string;
        rls: boolean;
        forced: boolean;
        policies: number;
      }>(
        `select c.relname as table_name, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
              (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
        where c.relkind = 'r'
          and exists (select 1 from information_schema.columns col
                       where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'organization_id')`,
      );
      expect(tables.length).toBeGreaterThan(5);

      for (const table of tables) {
        if (table.table_name in NO_RLS_ALLOWLIST) continue;
        expect(table, `${table.table_name}: RLS forzada`).toMatchObject({
          rls: true,
          forced: true,
        });
        expect(table.policies, `${table.table_name}: debe tener política`).toBeGreaterThan(0);

        const { rows: indexes } = await admin.query(
          `select 1 from pg_index i
           join pg_class t on t.oid = i.indrelid
           join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
          where t.relname = $1 and a.attname = 'organization_id'`,
          [table.table_name],
        );
        expect(
          indexes.length,
          `${table.table_name}: índice con organization_id primero`,
        ).toBeGreaterThan(0);
      }
    });
  },
);
