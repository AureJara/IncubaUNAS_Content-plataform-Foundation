import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { sha256Hex } from '@incubaunas/shared-kernel';

export interface MigrateOptions {
  /** Cadena del rol *migrator* (dueño del esquema), nunca la del rol de runtime. */
  connectionString: string;
  directory: string;
  log?: (message: string) => void;
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;
const NO_TRANSACTION_MARKER = '-- migrate:no-transaction';
/** Clave del advisory lock: evita que dos instancias migren a la vez. */
const LOCK_KEY = 7_350_001;

/**
 * Migraciones forward-only: los archivos aplicados son inmutables (se verifica su checksum) y no
 * existen "down". Un error de diseño se corrige con una migración nueva.
 */
export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
  const log = options.log ?? (() => undefined);
  const files = readdirSync(options.directory)
    .filter((name) => FILE_PATTERN.test(name))
    .sort();

  const versions = new Set<string>();
  for (const name of files) {
    const version = name.slice(0, 4);
    if (versions.has(version))
      throw new MigrationError(`Versión de migración duplicada: ${version}`);
    versions.add(version);
  }

  const client = new pg.Client({ connectionString: options.connectionString });
  await client.connect();
  const result: MigrateResult = { applied: [], skipped: [] };

  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`);

    const applied = new Map<string, { name: string; checksum: string }>(
      (await client.query('select version, name, checksum from schema_migrations')).rows.map(
        (row: { version: string; name: string; checksum: string }) => [row.version, row],
      ),
    );

    for (const [version, row] of applied) {
      if (!files.includes(row.name)) {
        throw new MigrationError(
          `La migración ${version} (${row.name}) ya se aplicó pero falta en disco.`,
        );
      }
    }

    for (const name of files) {
      const version = name.slice(0, 4);
      // Los saltos de línea no deben cambiar el checksum entre Windows y Linux.
      const sql = readFileSync(join(options.directory, name), 'utf8').replace(/\r\n/g, '\n');
      const checksum = sha256Hex(sql);

      const previous = applied.get(version);
      if (previous) {
        if (previous.checksum !== checksum) {
          throw new MigrationError(
            `La migración ${name} cambió después de aplicarse. Las migraciones son forward-only: crea una nueva.`,
          );
        }
        result.skipped.push(name);
        continue;
      }

      const transactional = !sql.startsWith(NO_TRANSACTION_MARKER);
      try {
        if (transactional) await client.query('begin');
        await client.query(sql);
        await client.query(
          'insert into schema_migrations (version, name, checksum) values ($1, $2, $3)',
          [version, name, checksum],
        );
        if (transactional) await client.query('commit');
      } catch (error) {
        if (transactional) await client.query('rollback').catch(() => undefined);
        throw new MigrationError(
          `Falló la migración ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      log(`aplicada ${name}`);
      result.applied.push(name);
    }
    return result;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}
