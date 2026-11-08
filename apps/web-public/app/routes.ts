// Rutas del sitio público. La portada (`/`) necesita su índice: en `/`, React Router prefiere la raíz sola antes que
// la ruta comodín. Las dos usan el mismo módulo de página.
import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/page.tsx', { id: 'home' }),
  route('eventos/:eventSlug', 'routes/event.tsx'),
  route('*', 'routes/page.tsx', { id: 'page' }),
] satisfies RouteConfig;
