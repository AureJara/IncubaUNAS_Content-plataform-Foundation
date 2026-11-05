import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { DashboardPage, ForbiddenPage, LoginPage, NotFoundPage } from './pages/Basic';
import { platformModules, type ShellModule } from './shell/modules';
import { Shell } from './shell/Shell';
import { ErrorState, Loading } from './shell/States';

/** Rutas según el estado de la sesión. Cada módulo se protege por su scope: sin él, "sin acceso". */
export function AppRoutes({ modules = platformModules }: { modules?: readonly ShellModule[] }) {
  const { state, can } = useAuth();

  if (state.status === 'loading') return <Loading label="Cargando tu sesión…" />;
  if (state.status === 'anonymous') return <LoginPage />;
  if (state.status === 'error') return <ErrorState error={state.error} />;

  return (
    <Routes>
      <Route element={<Shell modules={modules} />}>
        <Route index element={<DashboardPage />} />
        {modules.map((m) => (
          <Route
            key={m.id}
            path={m.path}
            element={can(m.requiredScope) ? m.element : <ForbiddenPage />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
