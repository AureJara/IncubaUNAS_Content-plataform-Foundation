// Empaquetado de contratos y generación de tipos (F0-01, API-04). Lo usan contracts:build y contracts:check.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APIS = ['auth', 'platform', 'cms', 'public'] as const;
export type ApiName = (typeof APIS)[number];

export const DIST_DIR = join(ROOT, 'contracts', 'dist');
export const GENERATED_DIR = join(ROOT, 'packages', 'api-client', 'src', 'generated');

function redoclyCli(): string {
  const require = createRequire(import.meta.url);
  const pkgFile = require.resolve('@redocly/cli/package.json');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin['redocly'] ?? Object.values(pkg.bin)[0]);
  if (bin === undefined) throw new Error('No encuentro el binario de @redocly/cli');
  return join(dirname(pkgFile), bin);
}

/** Empaqueta un contrato en un solo JSON con Redocly (las referencias internas se conservan). */
export async function bundle(api: ApiName, outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const output = join(outDir, `${api}.json`);
  execFileSync(
    process.execPath,
    [
      redoclyCli(),
      'bundle',
      join(ROOT, 'contracts', 'openapi', `${api}.yaml`),
      '--config',
      join(ROOT, 'contracts', 'redocly.yaml'),
      '--output',
      output,
      '--component-renaming-conflicts-severity',
      'error',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  // Formato estable: dos espacios y salto de línea final, para que el diff de la CI sea legible.
  const document: unknown = JSON.parse(await readFile(output, 'utf8'));
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
  return output;
}

/** Genera los tipos de `api-client` desde el contrato empaquetado. */
export async function generateTypes(api: ApiName, bundled: string, outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const document = JSON.parse(await readFile(bundled, 'utf8')) as Parameters<typeof openapiTS>[0];
  const ast = await openapiTS(document, { alphabetize: false });
  const header = `// Generado por \`pnpm contracts:build\` desde contracts/dist/${api}.json. No editar a mano.\n\n`;
  const output = join(outDir, `${api}.ts`);
  await writeFile(output, header + astToString(ast));
  return output;
}

/** Empaqueta y genera todo en los directorios indicados. */
export async function buildAll(dirs: { dist: string; generated: string }): Promise<void> {
  for (const api of APIS) {
    const bundled = await bundle(api, dirs.dist);
    await generateTypes(api, bundled, dirs.generated);
  }
}
