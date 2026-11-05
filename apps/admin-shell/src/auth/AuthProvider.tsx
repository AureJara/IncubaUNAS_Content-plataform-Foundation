import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api, type Capabilities, type Me, type Scope } from '../api/client';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; me: Me; capabilities: Capabilities | null }
  | { status: 'error'; error: ApiError };

export interface AuthContextValue {
  state: AuthState;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Verdadero si el usuario tiene el scope en la organización activa. */
  can: (scope: Scope | undefined) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return value;
}

/** Carga la identidad y los permisos efectivos desde la API; es la única fuente de verdad del panel. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const me = await api<Me>('/platform/v1/me');
      // Sin organización activa no hay capacidades: la persona aún debe elegir una.
      const capabilities = await api<Capabilities>('/platform/v1/me/capabilities').catch(
        (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        },
      );
      setState({ status: 'authenticated', me, capabilities });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState({ status: 'anonymous' });
      else
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError(0, 'network', 'Sin conexión'),
        });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      reload,
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setState({ status: 'anonymous' });
      },
      switchOrganization: async (organizationId) => {
        await api('/platform/v1/session-context', {
          method: 'POST',
          body: { organization_id: organizationId },
        });
        await reload();
      },
      can: (scope) =>
        !scope ||
        (state.status === 'authenticated' && !!state.capabilities?.scopes.includes(scope)),
    }),
    [state, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
