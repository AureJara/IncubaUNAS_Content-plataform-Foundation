// Gate de contratos (Sprint 0). Falla si un OpenAPI/AsyncAPI viola las convenciones del repo de
// arquitectura, si un ejemplo de evento no valida contra su schema o si falta un endpoint del catálogo.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contracts = join(root, 'contracts');
const failures = [];
const fail = (message) => failures.push(message);

const openapiFiles = ['platform.v1.yaml', 'cms.v1.yaml', 'public-read.v1.yaml'].map((f) =>
  join(contracts, 'openapi', f),
);
const asyncapiFile = join(contracts, 'asyncapi', 'platform-content.v1.yaml');

// ---------------------------------------------------------------- 1. Spectral (estructura)
// Se invoca el binario con el Node actual y sin shell: así los argumentos no se reinterpretan.
const require = createRequire(import.meta.url);
const spectralPackage = require.resolve('@stoplight/spectral-cli/package.json');
const spectralBin = resolve(
  dirname(spectralPackage),
  typeof require(spectralPackage).bin === 'string'
    ? require(spectralPackage).bin
    : require(spectralPackage).bin.spectral,
);

function runSpectral(files, ruleset) {
  const result = spawnSync(
    process.execPath,
    [spectralBin, 'lint', ...files, '--ruleset', ruleset, '--fail-severity', 'warn'],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0)
    fail(`Spectral reportó problemas en ${files.map((f) => relative(root, f)).join(', ')}`);
}
runSpectral(openapiFiles, join(contracts, '.spectral-openapi.yaml'));
runSpectral([asyncapiFile], join(contracts, '.spectral-asyncapi.yaml'));

// ---------------------------------------------------------------- utilidades de referencias
const yamlCache = new Map();
const loadYaml = (file) => {
  if (!yamlCache.has(file)) yamlCache.set(file, parse(readFileSync(file, 'utf8')));
  return yamlCache.get(file);
};
const pointerGet = (doc, pointer) =>
  pointer
    .split('/')
    .slice(1)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((node, key) => node?.[key], doc);

function deref(node, file) {
  let current = node;
  let currentFile = file;
  while (current && typeof current === 'object' && typeof current.$ref === 'string') {
    const [refFile, pointer = ''] = current.$ref.split('#');
    const targetFile = refFile ? resolve(dirname(currentFile), refFile) : currentFile;
    const doc = loadYaml(targetFile);
    current = pointer ? pointerGet(doc, pointer) : doc;
    currentFile = targetFile;
  }
  return { node: current, file: currentFile };
}

// ---------------------------------------------------------------- 2. Convenciones de OpenAPI
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const TENANT_FIELDS = ['organization_id', 'tenant_id'];
const TENANT_IN_BODY_ALLOWED = new Set(['switchOrganizationContext']);
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const seenOperationIds = new Set();
const documentedOperations = new Set();

function checkSnakeCase(schema, where) {
  if (!schema || typeof schema !== 'object') return;
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    if (!SNAKE_CASE.test(name)) fail(`${where}: la propiedad "${name}" no es snake_case`);
    checkSnakeCase(child, `${where}.${name}`);
  }
  if (schema.items) checkSnakeCase(schema.items, `${where}[]`);
  for (const key of ['allOf', 'oneOf', 'anyOf'])
    (schema[key] ?? []).forEach((s) => checkSnakeCase(s, where));
}

for (const file of openapiFiles) {
  const name = relative(root, file);
  const doc = loadYaml(file);
  if (!doc.openapi?.startsWith('3.1')) fail(`${name}: debe ser OpenAPI 3.1`);

  for (const [schemaName, schema] of Object.entries(doc.components?.schemas ?? {})) {
    checkSnakeCase(schema, `${name} components.schemas.${schemaName}`);
  }

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const label = `${name} ${method.toUpperCase()} ${path}`;
      documentedOperations.add(`${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, '{}')}`);

      if (!op.operationId) fail(`${label}: falta operationId`);
      else if (seenOperationIds.has(op.operationId))
        fail(`${label}: operationId duplicado "${op.operationId}"`);
      else seenOperationIds.add(op.operationId);

      if (!op.tags?.length) fail(`${label}: falta tags`);
      if (op.security === undefined)
        fail(
          `${label}: declara la seguridad de forma explícita (usa "security: []" si es público)`,
        );

      const params = [...(item.parameters ?? []), ...(op.parameters ?? [])].map(
        (p) => deref(p, file).node,
      );
      const hasHeader = (header) =>
        params.some((p) => p?.in === 'header' && p.name === header && p.required === true);

      if (method === 'post' && !path.startsWith('/auth/') && !hasHeader('Idempotency-Key')) {
        fail(`${label}: todo POST de comando exige el header Idempotency-Key`);
      }
      if (method === 'patch') {
        if (!hasHeader('If-Match')) fail(`${label}: todo PATCH exige If-Match`);
        if (!op.responses?.['412']) fail(`${label}: todo PATCH documenta 412 (revisión obsoleta)`);
      }

      for (const [status, response] of Object.entries(op.responses ?? {})) {
        if (!/^[45]/.test(status) || response.$ref) continue;
        if (!response.content?.['application/problem+json'])
          fail(`${label}: ${status} debe usar application/problem+json`);
      }

      for (const [mediaType, media] of Object.entries(op.requestBody?.content ?? {})) {
        const schema = deref(media.schema, file).node;
        if (!schema?.properties) continue;
        if (schema.additionalProperties !== false) {
          fail(`${label}: el cuerpo ${mediaType} debe declarar additionalProperties: false`);
        }
        const leaked = TENANT_FIELDS.filter((field) => field in schema.properties);
        if (leaked.length && !TENANT_IN_BODY_ALLOWED.has(op.operationId)) {
          fail(
            `${label}: el cuerpo no puede traer ${leaked.join(', ')}; el tenant sale de la sesión o del token`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 3. Cobertura del catálogo
const catalog = JSON.parse(readFileSync(join(contracts, 'catalog.team1.json'), 'utf8'));
const expected = new Set(catalog.operations.map((o) => o.operation));
const additions = new Set(catalog.additions.map((o) => o.operation));
for (const operation of expected) {
  if (!documentedOperations.has(operation)) fail(`catálogo: falta en los OpenAPI → ${operation}`);
}
for (const operation of documentedOperations) {
  if (!expected.has(operation) && !additions.has(operation)) {
    fail(`catálogo: operación no registrada en catalog.team1.json → ${operation}`);
  }
}
for (const operation of additions) {
  if (!documentedOperations.has(operation))
    fail(`catálogo: la adición no existe en los OpenAPI → ${operation}`);
}

// ---------------------------------------------------------------- 4. Schemas de eventos y ejemplos
const SCHEMA_BASE = 'https://schemas.incubaunas.dev/';
const schemasDir = join(contracts, 'schemas');
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

const listJson = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listJson(full) : entry.endsWith('.json') ? [full] : [];
  });
const keyFor = (file) => SCHEMA_BASE + relative(schemasDir, file).split(sep).join('/');

const schemaFiles = listJson(schemasDir);
for (const file of schemaFiles) ajv.addSchema(JSON.parse(readFileSync(file, 'utf8')), keyFor(file));

// "CI rechaza mensajes con PII no allowlisted": ningún campo de `data` puede ser un dato personal.
const FORBIDDEN_FIELD =
  /^(email|e_mail|phone|telefono|dni|document(_number)?|name|first_name|last_name|full_name|display_name|address|token|secret|password|qr|qr_payload)$/i;
function scanForPii(schema, where) {
  if (!schema || typeof schema !== 'object') return;
  for (const [field, child] of Object.entries(schema.properties ?? {})) {
    if (FORBIDDEN_FIELD.test(field))
      fail(`${where}: el campo "${field}" parece un dato personal y no puede viajar en un evento`);
    scanForPii(child, `${where}.${field}`);
  }
  if (schema.items) scanForPii(schema.items, `${where}[]`);
}

const examples = JSON.parse(
  readFileSync(join(contracts, 'examples', 'events.examples.json'), 'utf8'),
);
const eventSchemaFiles = schemaFiles.filter((f) => relative(schemasDir, f).startsWith('events'));
const topics = new Set();

for (const file of eventSchemaFiles) {
  const topic = file
    .split(sep)
    .pop()
    .replace(/\.json$/, '');
  topics.add(topic);
  const validate = ajv.getSchema(keyFor(file));
  const schema = JSON.parse(readFileSync(file, 'utf8'));
  scanForPii(schema.properties?.data, topic);

  if (schema.properties?.topic?.const !== topic)
    fail(`${topic}: el const de "topic" debe coincidir con el nombre del archivo`);
  const example = examples[topic];
  if (!example) {
    fail(`${topic}: falta un ejemplo en events.examples.json`);
    continue;
  }
  if (!validate(example))
    fail(`${topic}: el ejemplo no valida → ${ajv.errorsText(validate.errors)}`);

  // Un campo desconocido en `data` debe rechazarse en los eventos que posee el Equipo 1.
  if (
    schema.properties?.producer?.const === 'platform' ||
    schema.properties?.producer?.const === 'content'
  ) {
    const polluted = structuredClone(example);
    polluted.data.email = 'alguien@example.test';
    if (validate(polluted)) fail(`${topic}: el schema acepta un campo "email" en data`);
  }
}
for (const topic of Object.keys(examples)) {
  if (!topics.has(topic)) fail(`events.examples.json: el ejemplo "${topic}" no tiene schema`);
}

// ---------------------------------------------------------------- 5. AsyncAPI ↔ schemas
const asyncapi = loadYaml(asyncapiFile);
const addresses = Object.values(asyncapi.channels ?? {}).map((c) => c.address);
for (const topic of topics) {
  if (!addresses.includes(topic)) fail(`asyncapi: el topic ${topic} tiene schema pero no canal`);
}
for (const address of addresses) {
  if (!topics.has(address))
    fail(`asyncapi: el canal ${address} no tiene schema en contracts/schemas/events`);
}

// ---------------------------------------------------------------- resultado
if (failures.length) {
  console.error(`\n✗ ${failures.length} problema(s) en los contratos:`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(
  `\n✓ Contratos válidos: ${documentedOperations.size} operaciones HTTP (${expected.size} del catálogo + ${additions.size} adiciones), ${topics.size} topics de eventos.`,
);
