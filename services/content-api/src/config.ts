import { APP_ENVS, DATA_SOURCES, env, loadConfig, type AppEnv, type DataSource } from '@incuba/http-kit';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

interface BaseConfig {
  appEnv: AppEnv;
  logLevel: string;
  port: number;
  /** Adaptadores de los casos de uso (MOCK-03). */
  dataSource: DataSource;
}

export interface CmsConfig extends BaseConfig {
  /** Emisor y JWKS de los tokens internos (el gateway). */
  issuer: string;
  jwksUrl: URL;
}

export type PublicConfig = BaseConfig;

type Source = Readonly<Record<string, string | undefined>>;

/** Si algo falta o es inválido, el servicio no arranca y lista todos los errores (PF-051). */
export function readCmsConfig(source: Source): CmsConfig {
  return loadConfig<CmsConfig>(source, {
    appEnv: ['APP_ENV', env.oneOf(APP_ENVS)],
    logLevel: ['LOG_LEVEL', env.oneOf(LOG_LEVELS, 'info')],
    port: ['CONTENT_CMS_PORT', env.port(8082)],
    dataSource: ['DATA_SOURCE', env.oneOf(DATA_SOURCES)],
    issuer: ['GATEWAY_ISSUER', env.string()],
    jwksUrl: ['GATEWAY_JWKS_URL', env.url()],
  });
}

export function readPublicConfig(source: Source): PublicConfig {
  return loadConfig<PublicConfig>(source, {
    appEnv: ['APP_ENV', env.oneOf(APP_ENVS)],
    logLevel: ['LOG_LEVEL', env.oneOf(LOG_LEVELS, 'info')],
    port: ['CONTENT_PUBLIC_PORT', env.port(8083)],
    dataSource: ['DATA_SOURCE', env.oneOf(DATA_SOURCES)],
  });
}
