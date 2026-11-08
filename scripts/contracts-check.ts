// pnpm contracts:check — lo que Redocly no revisa (F0-01, F0-03, MOCK-02):
// 1. contracts/dist y los tipos generados están al día con contracts/openapi;
// 2. cada operación tiene ejemplo para su respuesta por defecto y su cuerpo, y cada ejemplo valida con el mismo Ajv
//    que usa http-kit en ejecución;
// 3. convenciones de spec 9.1: Idempotency-Key en POST de comando, If-Match en PATCH/PUT, errores en Problem Details;
// 4. ningún secreto en el repositorio público;
// 5. toda ruta del catálogo (spec 9.2–9.6) existe en algún contrato.
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative } from 'node:path';
import {
  loadContract,
  mockResponse,
  SchemaCompiler,
  type Contract,
  type JsonSchema,
  type OperationSpec,
} from '../packages/http-kit/src/index.ts';
import { APIS, buildAll, DIST_DIR, GENERATED_DIR, ROOT, type ApiName } from './lib/contracts.ts';

const problems: string[] = [];
const compiler = new SchemaCompiler();

// 1. Deriva entre la fuente y lo generado.
async function checkDrift(): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), 'incuba-contracts-'));
  try {
    await buildAll({ dist: join(temp, 'dist'), generated: join(temp, 'generated') });
    for (const api of APIS) {
      for (const [fresh, committed] of [
        [join(temp, 'dist', `${api}.json`), join(DIST_DIR, `${api}.json`)],
        [join(temp, 'generated', `${api}.ts`), join(GENERATED_DIR, `${api}.ts`)],
      ] as const) {
        const current = await readFile(committed, 'utf8').catch(() => undefined);
        if (current !== (await readFile(fresh, 'utf8'))) {
          problems.push(`${relative(ROOT, committed)} no está al día: corre pnpm contracts:build`);
        }
      }
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

// 2. Ejemplos.
function checkExamples(
  where: string,
  schema: JsonSchema | undefined,
  examples: Readonly<Record<string, { value: unknown }>>,
) {
  if (schema === undefined) return;
  const validate = compiler.body(schema);
  for (const [name, example] of Object.entries(examples)) {
    for (const error of validate(example.value)) {
      problems.push(`${where} ejemplo "${name}": ${error.pointer} ${error.detail}`);
    }
  }
}

function checkOperationExamples(api: ApiName, op: OperationSpec): void {
  const where = `${api}:${op.operationId}`;
  const success = op.responses.find((r) => r.status >= 200 && r.status < 400);
  if (success && Object.keys(success.content).length > 0 && mockResponse(op) === undefined) {
    problems.push(`${where}: la respuesta ${success.status} no tiene ejemplo (MOCK-01)`);
  }
  for (const response of op.responses) {
    for (const [type, media] of Object.entries(response.content)) {
      checkExamples(`${where} ${response.status} ${type}`, media.schema, media.examples);
    }
  }
  for (const [type, media] of Object.entries(op.requestBody?.content ?? {})) {
    if (Object.keys(media.examples).length === 0) problems.push(`${where}: el cuerpo ${type} no tiene ejemplo`);
    checkExamples(`${where} cuerpo ${type}`, media.schema, media.examples);
  }
}

// 3. Convenciones de spec 9.1.
const requiresHeader = (op: OperationSpec, name: string): boolean =>
  op.parameters.some((p) => p.in === 'header' && p.name.toLowerCase() === name && p.required);

function checkConventions(api: ApiName, op: OperationSpec): void {
  const where = `${api}:${op.operationId}`;
  const command = op.method === 'post' && /^\/(platform|cms|public)\//.test(op.path);
  if (command && !requiresHeader(op, 'idempotency-key')) {
    problems.push(`${where}: un POST de comando exige Idempotency-Key`);
  }
  if ((op.method === 'patch' || op.method === 'put') && !requiresHeader(op, 'if-match')) {
    problems.push(`${where}: ${op.method.toUpperCase()} exige If-Match`);
  }
  checkErrorFormat(where, op);
}

function checkErrorFormat(where: string, op: OperationSpec): void {
  // RFC 6749 define su propio formato de error; el 503 de `ready` lleva el estado de cada dependencia (PF-055).
  if (op.path === '/oauth/token' || op.path.startsWith('/health/')) return;
  for (const response of op.responses.filter((r) => r.status >= 400)) {
    if (Object.keys(response.content).some((type) => type !== 'application/problem+json')) {
      problems.push(`${where} ${response.status}: los errores van en application/problem+json`);
    }
  }
}

// 4. Secretos. Los patrones se arman por partes para que este archivo no se detecte a sí mismo.
const SECRET_PATTERNS: readonly [string, RegExp][] = [
  ['clave privada PEM', new RegExp('-----' + 'BEGIN [A-Z ]*PRIVATE KEY')],
  ['JWT', new RegExp('ey' + 'J[A-Za-z0-9_-]{10,}\\.ey' + 'J[A-Za-z0-9_-]{10,}\\.')],
  ['clave de AWS', new RegExp('AK' + 'IA[0-9A-Z]{16}')],
  ['token de GitHub', new RegExp('gh' + 'p_[A-Za-z0-9]{36}|github' + '_pat_[A-Za-z0-9_]{20,}')],
  ['clave de Stripe', new RegExp('sk' + '_live_[A-Za-z0-9]{10,}')],
  ['token de Slack', new RegExp('xo' + 'x[abprs]-[A-Za-z0-9-]{10,}')],
];
const SCANNED = new Set(['.ts', '.js', '.json', '.yaml', '.yml', '.md', '.example', '.html', '.css', '.tsx']);
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'coverage', '.pnpm-store']);

async function* files(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) yield* files(join(dir, entry.name));
    } else if (SCANNED.has(extname(entry.name)) || entry.name.startsWith('.env')) {
      yield join(dir, entry.name);
    }
  }
}

async function checkSecrets(): Promise<void> {
  for await (const file of files(ROOT)) {
    const name = relative(ROOT, file);
    if (name === '.env') continue; // ignorado por git; nunca se sube
    const text = await readFile(file, 'utf8');
    for (const [label, pattern] of SECRET_PATTERNS) {
      if (pattern.test(text)) problems.push(`${name}: parece contener un secreto (${label})`);
    }
  }
}

// 5. Catálogo de spec 9.2–9.6 (F0-03).
async function checkCatalog(contracts: readonly Contract[]): Promise<number> {
  const spec = await readFile(join(ROOT, 'spec.md'), 'utf8');
  const start = spec.indexOf('### 9.2');
  const end = spec.indexOf('### 9.7');
  const section = spec.slice(start, end);
  const normalize = (path: string) => path.replace(/\{[^}]+\}/g, '{}');
  const published = new Set(
    contracts.flatMap((c) => c.operations.map((op) => `${op.method.toUpperCase()} ${normalize(op.path)}`)),
  );
  const routes = [...section.matchAll(/`(GET|POST|PUT|PATCH|DELETE) (\/[^`?\s]*)/g)].map(
    ([, method, path]) => `${method} ${normalize(path ?? '')}`,
  );
  for (const route of new Set(routes)) {
    if (!published.has(route)) problems.push(`catálogo: ${route} no está en ningún contrato`);
  }
  return new Set(routes).size;
}

await checkDrift();
const contracts: Contract[] = [];
let operations = 0;
for (const api of APIS) {
  const contract = loadContract(JSON.parse(await readFile(join(DIST_DIR, `${api}.json`), 'utf8')));
  contracts.push(contract);
  for (const op of contract.operations) {
    operations += 1;
    checkOperationExamples(api, op);
    checkConventions(api, op);
  }
}
await checkSecrets();
const catalogRoutes = await checkCatalog(contracts);

if (problems.length > 0) {
  console.error(`contracts:check encontró ${problems.length} problema(s):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`contracts:check OK: ${operations} operaciones, ${catalogRoutes} rutas del catálogo, sin secretos.`);
