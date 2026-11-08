// Las fronteras de capas (spec 3.4) y las reglas de los frontends (FE-01, FE-03) se cumplen con ESLint; esta prueba
// asegura que las reglas siguen activas.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslint = new ESLint({ cwd: ROOT });
const SERVICE = 'services/platform-api/src';

async function rulesHitAt(code: string, path: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, path) });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

const rulesHit = (code: string, file: string) => rulesHitAt(code, `${SERVICE}/${file}`);

// Cargar la configuración y los plugins la primera vez tarda varios segundos cuando corren todas las pruebas a la vez.
beforeAll(async () => {
  await eslint.calculateConfigForFile(join(ROOT, SERVICE, 'domain/x.ts'));
}, 60_000);

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

describe('frontends (spec 3.7)', () => {
  const SHELL = 'apps/admin-shell/src/x.ts';

  it('no importan el código de los servicios ni librerías del backend', async () => {
    expect(await rulesHitAt("import { x } from '@incuba/http-kit';\nexport const y = x;\n", SHELL)).toContain(
      'no-restricted-imports',
    );
    expect(await rulesHitAt("import pg from 'pg';\nexport const db = pg;\n", 'apps/web-public/app/x.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('React Router es la única capa de datos (FE-01)', async () => {
    expect(
      await rulesHitAt("import { useQuery } from '@tanstack/react-query';\nexport const q = useQuery;\n", SHELL),
    ).toContain('no-restricted-imports');
  });

  it('sin APIs unstable_ de React Router (FE-03)', async () => {
    expect(
      await rulesHitAt(
        "import { unstable_usePrompt } from 'react-router';\nexport const p = unstable_usePrompt;\n",
        SHELL,
      ),
    ).toContain('no-restricted-imports');
    expect(
      await rulesHitAt("import { useLoaderData } from 'react-router';\nexport const l = useLoaderData;\n", SHELL),
    ).not.toContain('no-restricted-imports');
  });
});
