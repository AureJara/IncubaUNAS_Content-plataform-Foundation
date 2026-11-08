// Las fronteras de capas (spec 3.4) se cumplen con ESLint; esta prueba asegura que las reglas siguen activas.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslint = new ESLint({ cwd: ROOT });
const SERVICE = 'services/platform-api/src';

async function rulesHit(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, SERVICE, file) });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

describe('fronteras de capas (spec 3.4)', () => {
  it('domain/ no importa librerías de I/O ni otras capas', async () => {
    expect(await rulesHit("import pg from 'pg';\nexport const db = pg;\n", 'domain/organization.ts')).toContain(
      'no-restricted-imports',
    );
    expect(
      await rulesHit("import { repo } from '../infrastructure/repo.ts';\nexport const r = repo;\n", 'domain/x.ts'),
    ).toContain('no-restricted-imports');
  });

  it('domain/ no lee process.env ni Date.now()', async () => {
    const hits = await rulesHit('export const a = process.env.X;\nexport const b = Date.now();\n', 'domain/x.ts');
    expect(hits).toEqual(expect.arrayContaining(['no-restricted-globals', 'no-restricted-properties']));
  });

  it('application/ no importa adaptadores ni frameworks', async () => {
    expect(
      await rulesHit("import Fastify from 'fastify';\nexport const app = Fastify;\n", 'application/create.ts'),
    ).toContain('no-restricted-imports');
  });

  it('interfaces/ no hace SQL', async () => {
    expect(await rulesHit("import pg from 'pg';\nexport const db = pg;\n", 'interfaces/http/routes.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('infrastructure/ sí puede usar las librerías de I/O', async () => {
    expect(await rulesHit("import pg from 'pg';\nexport const db = pg;\n", 'infrastructure/db.ts')).not.toContain(
      'no-restricted-imports',
    );
  });
});
