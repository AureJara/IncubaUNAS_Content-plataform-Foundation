import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

// Renderizado en servidor sobre la Public Read API: cada respuesta hereda los headers de caché
// (ETag, Cache-Control, Surrogate-Key) para que el CDN sirva las visitas sin llegar al origen.
// Los estilos vienen del diseño "Nexus Horizon": Tailwind 3 por PostCSS (postcss.config.mjs) con el tailwind.config.mjs
// del equipo de frontend, igual que su build.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321, host: true },
  // Rechaza POST de otro origen: el sitio público no tiene formularios propios todavía.
  security: { checkOrigin: true },
  // Variables de servidor leídas en tiempo de ejecución: la misma imagen sirve a cualquier entorno.
  env: {
    schema: {
      SITE_SLUG: envField.string({ context: 'server', access: 'secret' }),
      CONTENT_API_URL: envField.string({
        context: 'server',
        access: 'secret',
        default: 'http://localhost:4001',
      }),
      MEDIA_BASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Origen del panel de administración: ahí vive el inicio de sesión (BFF + OIDC).
      ADMIN_URL: envField.string({
        context: 'server',
        access: 'secret',
        default: 'http://localhost:3000',
      }),
    },
  },
  vite: {
    envDir: '../../',
    // La CSP no admite scripts en línea ni `data:` en fuentes. Vite inlinaría por defecto lo que pese menos
    // de 4 KB (el script del menú móvil, algún subconjunto de fuente): todo se emite como archivo propio.
    build: { assetsInlineLimit: 0 },
  },
});
