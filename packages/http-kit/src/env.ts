export const APP_ENVS = ['local', 'ci', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const DATA_SOURCES = ['memory', 'real'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** Los mocks (contrato, memoria y sesión de prueba) solo existen en local y CI (MOCK-06). */
export function mocksAllowed(env: AppEnv): boolean {
  return env === 'local' || env === 'ci';
}

/** Error de configuración: el servicio no arranca (PF-051). */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Configuración inválida:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

type Source = Readonly<Record<string, string | undefined>>;
type Parser<T> = (raw: string | undefined, name: string) => T;

/** Lee y valida toda la configuración de una vez; junta todos los errores antes de fallar. */
export function loadConfig<T extends object>(
  source: Source,
  spec: { [K in keyof T]: [envName: string, parse: Parser<T[K]>] },
): T {
  const problems: string[] = [];
  const result: Record<string, unknown> = {};
  for (const [key, [envName, parse]] of Object.entries(spec) as [string, [string, Parser<unknown>]][]) {
    try {
      result[key] = parse(source[envName], envName);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (problems.length > 0) throw new ConfigError(problems);
  return result as T;
}

const present = (raw: string | undefined, name: string): string => {
  if (raw === undefined || raw.trim() === '') throw new Error(`${name} es obligatorio`);
  return raw.trim();
};

export const env = {
  string: (): Parser<string> => present,
  optionalString:
    (fallback: string): Parser<string> =>
    (raw) =>
      raw === undefined || raw.trim() === '' ? fallback : raw.trim(),
  oneOf:
    <V extends string>(values: readonly V[], fallback?: V): Parser<V> =>
    (raw, name) => {
      const value = raw === undefined || raw.trim() === '' ? fallback : raw.trim();
      if (value === undefined) throw new Error(`${name} es obligatorio (${values.join(', ')})`);
      if (!(values as readonly string[]).includes(value)) {
        throw new Error(`${name} debe ser uno de: ${values.join(', ')}`);
      }
      return value as V;
    },
  port:
    (fallback?: number): Parser<number> =>
    (raw, name) => {
      if ((raw === undefined || raw === '') && fallback !== undefined) return fallback;
      const port = Number(present(raw, name));
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${name} debe ser un puerto válido`);
      return port;
    },
  url: (): Parser<URL> => (raw, name) => {
    const value = present(raw, name);
    try {
      return new URL(value);
    } catch {
      throw new Error(`${name} debe ser una URL válida`);
    }
  },
};

/**
 * Corta el arranque si el entorno no admite mocks y algo los usa (MOCK-06): operaciones sin caso de uso,
 * `DATA_SOURCE=memory` o la sesión de prueba del gateway.
 */
export function assertNoMocksOutsideLocal(
  appEnv: AppEnv,
  usage: { mockedOperations?: readonly string[]; dataSource?: DataSource; testSession?: boolean },
): void {
  if (mocksAllowed(appEnv)) return;
  const problems: string[] = [];
  if (usage.mockedOperations && usage.mockedOperations.length > 0) {
    problems.push(`operaciones sin caso de uso en ${appEnv}: ${usage.mockedOperations.join(', ')}`);
  }
  if (usage.dataSource === 'memory') problems.push(`DATA_SOURCE=memory no se permite en ${appEnv}`);
  if (usage.testSession) problems.push(`la sesión de prueba no se permite en ${appEnv}`);
  if (problems.length > 0) throw new ConfigError(problems);
}
