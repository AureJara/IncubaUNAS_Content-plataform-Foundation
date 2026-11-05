import type { ReactNode } from 'react';
import { ApiError, friendlyMessage } from '../api/client';
import type { AsyncState } from './useAsync';

export const Loading = ({ label = 'Cargando…' }: { label?: string }) => (
  <p role="status" aria-live="polite">
    {label}
  </p>
);

export const EmptyState = ({ children }: { children: ReactNode }) => (
  <p className="notice">{children}</p>
);

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <div role="alert" className="notice notice-error">
      <p>{forbidden ? 'No tienes permiso para ver esto.' : friendlyMessage(error)}</p>
      {error instanceof ApiError && error.requestId && (
        <p>
          <small>Referencia de soporte: {error.requestId}</small>
        </p>
      )}
      {onRetry && !forbidden && (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Renderiza los estados de carga y error y delega el caso listo (y el vacío) en la página. */
export function Resource<T>({
  state,
  onRetry,
  children,
}: {
  state: AsyncState<T>;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}
