// Render del servidor (FE-04). Espera a `onAllReady` para tener el HTML completo: así se calculan los hashes de los
// scripts en línea para la CSP, y bots y personas reciben la misma página cacheable. No escribe cookies.
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext } from 'react-router';
import { PassThrough } from 'node:stream';
import { documentHeaders } from './csp.server.ts';

export const streamTimeout = 5_000;

function collect(stream: PassThrough): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let status = responseStatusCode;
    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={routerContext} url={request.url} />, {
      onAllReady() {
        const sink = new PassThrough();
        collect(sink).then((html) => {
          const headers = documentHeaders(responseHeaders, { status, html, dev: import.meta.env.DEV });
          resolve(new Response(request.method === 'HEAD' ? null : html, { status, headers }));
        }, reject);
        pipe(sink);
      },
      onShellError(error: unknown) {
        reject(error);
      },
      onError(error: unknown) {
        status = 500;
        console.error(error);
      },
    });
    setTimeout(abort, streamTimeout + 1_000);
  });
}
