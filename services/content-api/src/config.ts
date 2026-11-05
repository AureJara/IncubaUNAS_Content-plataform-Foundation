import { z } from 'zod';

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const schema = z.object({
  CONTENT_API_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  CONTENT_DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  INTERNAL_JWT_SECRET: z.string().min(32),
  INTERNAL_JWT_ISSUER: z.string().default('https://platform.incubaunas.local'),
  CONTENT_JWT_AUDIENCE: z.string().default('content-api'),
  /** Base pública del sitio donde se abre la vista previa de un borrador. */
  PREVIEW_BASE_URL: z.string().url().default('http://localhost:4321'),
  OIDC_RETURN_TO_ALLOWLIST: csv,
});

export type ContentConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ContentConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Configuración inválida:\n  ${problems}`);
  }
  return parsed.data;
}
