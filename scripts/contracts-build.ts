// pnpm contracts:build — empaqueta los contratos en contracts/dist y genera los tipos de api-client.
import { relative } from 'node:path';
import { APIS, buildAll, DIST_DIR, GENERATED_DIR, ROOT } from './lib/contracts.ts';

await buildAll({ dist: DIST_DIR, generated: GENERATED_DIR });
console.log(`Contratos empaquetados (${APIS.join(', ')}) en ${relative(ROOT, DIST_DIR)}`);
console.log(`Tipos generados en ${relative(ROOT, GENERATED_DIR)}`);
