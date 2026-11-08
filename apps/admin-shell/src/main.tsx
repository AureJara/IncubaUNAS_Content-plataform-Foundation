// Punto de entrada del shell. Las APIs van por el gateway en el mismo origen, así que la cookie de sesión viaja sola y
// el shell nunca ve tokens (spec 6.1).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterContextProvider } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { apiContext, createApi } from './api.ts';
import { routes } from './routes.tsx';
import './app.css';

const api = createApi(window.location.origin);

const router = createBrowserRouter(routes, {
  getContext() {
    const context = new RouterContextProvider();
    context.set(apiContext, api);
    return context;
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Falta el elemento #root en index.html.');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
