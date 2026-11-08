import { ConfigError, listen } from '@incuba/http-kit';
import { buildPublicApi } from './app.ts';
import { readPublicConfig } from './config.ts';

try {
  const config = readPublicConfig(process.env);
  const app = await buildPublicApi({ config });
  await listen(app, config.port);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}
