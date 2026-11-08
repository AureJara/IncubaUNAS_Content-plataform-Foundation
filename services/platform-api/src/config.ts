import { APP_ENVS, DATA_SOURCES, env, loadConfig, type AppEnv, type DataSource } from '@incuba/http-kit';

export interface PlatformConfig {
  appEnv: AppEnv;
  logLevel: string;
  port: number;
  /** Adaptadores de los casos de uso (MOCK-03). */
  dataSource: DataSource;
  /** Emisor y JWKS de los tokens internos (el gateway). */
  issuer: string;
  jwksUrl: URL;
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

/** Si algo falta o es inválido, el servicio no arranca y lista todos los errores (PF-051). */
export function readConfig(source: Readonly<Record<string, string | undefined>>): PlatformConfig {
  return loadConfig<PlatformConfig>(source, {
    appEnv: ['APP_ENV', env.oneOf(APP_ENVS)],
    logLevel: ['LOG_LEVEL', env.oneOf(LOG_LEVELS, 'info')],
    port: ['PLATFORM_API_PORT', env.port(8081)],
    dataSource: ['DATA_SOURCE', env.oneOf(DATA_SOURCES)],
    issuer: ['GATEWAY_ISSUER', env.string()],
    jwksUrl: ['GATEWAY_JWKS_URL', env.url()],
  });
}
