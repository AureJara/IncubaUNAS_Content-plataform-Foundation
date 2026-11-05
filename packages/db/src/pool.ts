import pg from 'pg';

export type Pool = pg.Pool;
export type DbClient = pg.PoolClient;

export interface PoolOptions {
  connectionString: string;
  max?: number;
  applicationName?: string;
}

/**
 * Pool de conexiones del rol de runtime. Ese rol es NOSUPERUSER y NOBYPASSRLS: el aislamiento por
 * organización lo impone PostgreSQL aunque la aplicación tenga un defecto.
 */
export function createPool(options: PoolOptions): Pool {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // Un cliente inactivo que se rompe no debe tumbar el proceso.
  pool.on('error', (error) => console.error('Error en conexión inactiva del pool:', error.message));
  return pool;
}
