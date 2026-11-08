import { ROLES, type Role } from '@incuba/authz';
import { APP_ENVS, env, loadConfig, type AppEnv } from '@incuba/http-kit';

export interface GatewayConfig {
  appEnv: AppEnv;
  logLevel: string;
  port: number;
  /** `iss` de los tokens internos. */
  issuer: string;
  platformUrl: URL;
  cmsUrl: URL;
  /** Rol del usuario de la sesión de prueba (MOCK-05). */
  mockRole: Role;
}

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

/** Lee la configuración; si algo falta o es inválido, el gateway no arranca y lista todos los errores (PF-051). */
export function readConfig(source: Readonly<Record<string, string | undefined>>): GatewayConfig {
  return loadConfig<GatewayConfig>(source, {
    appEnv: ['APP_ENV', env.oneOf(APP_ENVS)],
    logLevel: ['LOG_LEVEL', env.oneOf(LOG_LEVELS, 'info')],
    port: ['GATEWAY_PORT', env.port(8080)],
    issuer: ['GATEWAY_ISSUER', env.string()],
    platformUrl: ['PLATFORM_API_URL', env.url()],
    cmsUrl: ['CONTENT_CMS_URL', env.url()],
    mockRole: ['MOCK_ROLE', env.oneOf(ROLES, 'site_editor')],
  });
}
