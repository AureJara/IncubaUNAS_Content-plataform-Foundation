import { z } from 'zod';

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const schema = z.object({
  PLATFORM_API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PLATFORM_DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),

  OIDC_ISSUER: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  OIDC_REDIRECT_URI: z.string().url(),
  OIDC_ALLOW_INSECURE: z.enum(['true', 'false']).default('false'),
  /** Destinos permitidos tras el login; se comparan por origen. */
  OIDC_RETURN_TO_ALLOWLIST: csv,

  SESSION_COOKIE_NAME: z.string().default('__Host-session'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  CSRF_SECRET: z.string().min(32),
  PII_ENCRYPTION_KEY: z.string().min(40),

  INTERNAL_JWT_SECRET: z.string().min(32),
  INTERNAL_JWT_ISSUER: z.string().default('https://platform.incubaunas.local'),
  INTERNAL_JWT_AUDIENCE: z.string().default('platform-api'),

  ADMIN_BASE_URL: z.string().url(),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_FROM: z.string().default('IncubaUNAS <no-reply@incubaunas.local>'),
});

export type PlatformConfig = z.infer<typeof schema>;

/** Falla al arrancar, con un mensaje claro, si falta o es inválida una variable de entorno. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): PlatformConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Configuración inválida:\n  ${problems}`);
  }
  return parsed.data;
}

/** Orígenes (esquema + host + puerto) de una lista de URLs. */
export const originsOf = (urls: readonly string[]): string[] => [
  ...new Set(urls.map((u) => new URL(u).origin)),
];
