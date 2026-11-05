import type { APIRoute } from 'astro';

// Sondeo de salud para el balanceador: no depende de la API de contenido (readiness ≠ liveness).
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
