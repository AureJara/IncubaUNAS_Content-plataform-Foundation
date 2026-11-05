import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MigrationError, migrate } from '../src/index.js';

const adminUrl = process.env.PLATFORM_DATABASE_ADMIN_URL;
if (!adminUrl && process.env.CI) throw new Error('CI exige PLATFORM_DATABASE_ADMIN_URL');

describe.skipIf(!adminUrl)('migrate (forward-only)', () => {
  const schema = `migrate_test_${Date.now()}`;
  let directory: string;
  let connectionString: string;
  let admin: pg.Client;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create schema ${schema}`);
    // El schema de prueba aísla `schema_migrations` de la base real.
    const url = new URL(adminUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    connectionString = url.toString();
    directory = mkdtempSync(join(tmpdir(), 'migrations-'));
  });

  afterAll(async () => {
    await admin.query(`drop schema ${schema} cascade`);
    await admin.end();
    rmSync(directory, { recursive: true, force: true });
  });

  const write = (name: string, sql: string) => writeFileSync(join(directory, name), sql);

  it('aplica en orden, es idempotente y detecta migraciones modificadas', async () => {
    write('0001_create_a.sql', 'create table a (id int primary key);');
    write('0002_create_b.sql', 'create table b (id int primary key);');

    const first = await migrate({ connectionString, directory });
    expect(first.applied).toEqual(['0001_create_a.sql', '0002_create_b.sql']);

    const second = await migrate({ connectionString, directory });
    expect(second.applied).toEqual([]);
    expect(second.skipped).toHaveLength(2);

    write('0001_create_a.sql', 'create table a (id int primary key, extra text);');
    await expect(migrate({ connectionString, directory })).rejects.toThrow(
      /cambió después de aplicarse/,
    );
  });

  it('revierte por completo una migración que falla y no la registra', async () => {
    write('0001_create_a.sql', 'create table a (id int primary key);');
    write('0003_broken.sql', 'create table c (id int); select no_existe();');

    await expect(migrate({ connectionString, directory })).rejects.toBeInstanceOf(MigrationError);

    const { rows } = await admin.query(
      `select to_regclass('${schema}.c') as c, (select count(*) from ${schema}.schema_migrations where version = '0003') as n`,
    );
    expect(rows[0]).toEqual({ c: null, n: '0' });
  });

  it('rechaza versiones duplicadas', async () => {
    write('0003_broken.sql', 'select 1;');
    write('0003_otra.sql', 'select 2;');
    await expect(migrate({ connectionString, directory })).rejects.toThrow(/duplicada/);
  });
});
