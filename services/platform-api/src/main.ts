import { ConfigError, listen } from '@incuba/http-kit';
import { buildPlatformApi } from './app.ts';
import { readConfig } from './config.ts';

try {
  const config = readConfig(process.env);
  const app = await buildPlatformApi({ config });
  await listen(app, config.port);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}
