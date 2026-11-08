// Cliente de la Public Read API (spec 9.4). Los loaders lo toman del contexto del router, así que las pruebas
// inyectan uno con `fetch` falso (FE-02); si el contexto no trae uno, se crea con CONTENT_PUBLIC_URL.
import { createPublicClient } from '@incuba/api-client';
import { createContext, data, type RouterContextProvider } from 'react-router';

export type PublicApi = ReturnType<typeof createPublicClient>;

export const publicApiContext = createContext<PublicApi | null>(null);

let defaultClient: PublicApi | undefined;

function clientFromEnv(): PublicApi {
  if (!defaultClient) {
    const baseUrl = process.env['CONTENT_PUBLIC_URL'];
    if (!baseUrl) throw new Error('Falta CONTENT_PUBLIC_URL: copia .env.example a .env.');
    defaultClient = createPublicClient({ baseUrl: new URL(baseUrl).origin });
  }
  return defaultClient;
}

export function publicApi(context: Readonly<RouterContextProvider>): PublicApi {
  return context.get(publicApiContext) ?? clientFromEnv();
}

/** 404 del contrato → 404 del sitio; cualquier otro fallo de la API → 502, sin exponer el detalle (SEC-11). */
export function upstreamError(response: Response): never {
  if (response.status === 404 || response.status === 400) throw data(null, { status: 404 });
  throw data(null, { status: 502 });
}
