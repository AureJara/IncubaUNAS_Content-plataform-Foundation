import { fileURLToPath } from 'node:url';
import { migrate } from '@incubaunas/db';

const connectionString = process.env.PLATFORM_DATABASE_ADMIN_URL;
if (!connectionString) {
  console.error('Falta PLATFORM_DATABASE_ADMIN_URL (el rol *migrator*, no el de runtime).');
  process.exit(1);
}

const result = await migrate({
  connectionString,
  directory: fileURLToPath(new URL('../migrations', import.meta.url)),
  log: (message) => console.log(message),
});
console.log(
  `Migraciones: ${result.applied.length} aplicadas, ${result.skipped.length} ya existentes.`,
);
