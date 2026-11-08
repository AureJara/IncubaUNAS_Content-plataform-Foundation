import { ConfigError, listen } from '@incuba/http-kit';
import { buildCmsApi } from './app.ts';
import { readCmsConfig } from './config.ts';

try {
  const config = readCmsConfig(process.env);
  const app = await buildCmsApi({ config });
  await listen(app, config.port);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}
