// Clientes de las APIs a través del gateway, en el mismo origen que el shell (spec 3.7). Los loaders y middlewares los
// leen del contexto del router, así que las pruebas inyectan un `fetch` falso sin tocar las rutas (FE-02).
import { createCmsClient, createPlatformClient, isProblem, type ApiClientOptions } from '@incuba/api-client';
import { createContext, data } from 'react-router';

export interface Api {
  platform: ReturnType<typeof createPlatformClient>;
  cms: ReturnType<typeof createCmsClient>;
}

export const apiContext = createContext<Api>();

export function createApi(baseUrl: string, fetch?: ApiClientOptions['fetch']): Api {
  const options: ApiClientOptions = fetch ? { baseUrl, fetch } : { baseUrl };
  return { platform: createPlatformClient(options), cms: createCmsClient(options) };
}

/** Convierte una respuesta fallida en un error de la ruta; conserva el Problem Details si lo trae (FE-02). */
export function routeError(response: Response, error: unknown): never {
  throw data(isProblem(error) ? error : null, { status: response.status });
}
