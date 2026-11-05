import { useState } from 'react';
import { api, friendlyMessage, type SessionInfo } from '../api/client';
import { EmptyState, Resource } from '../shell/States';
import { useAsync } from '../shell/useAsync';

export function SessionsPage() {
  const sessions = useAsync(() => api<{ items: SessionInfo[] }>('/platform/v1/me/sessions'));
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    try {
      await api(`/platform/v1/me/sessions/${id}`, { method: 'DELETE' });
      setError(null);
    } catch (e) {
      setError(friendlyMessage(e));
    }
    sessions.reload();
  }

  return (
    <section aria-labelledby="sesiones-titulo">
      <h1 id="sesiones-titulo">Mis sesiones</h1>
      <div aria-live="polite" role="status">
        {error && <p className="notice notice-error">{error}</p>}
      </div>
      <Resource state={sessions} onRetry={sessions.reload}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState>No hay sesiones activas.</EmptyState>
          ) : (
            <ul className="plain">
              {items.map((s) => (
                <li key={s.id} className="card">
                  <p>
                    <strong>{s.device_label ?? 'Dispositivo desconocido'}</strong>{' '}
                    {s.current && <span className="badge">Esta sesión</span>}
                  </p>
                  <p>
                    <small>Último uso: {new Date(s.last_used_at).toLocaleString('es-PE')}</small>
                  </p>
                  {!s.current && (
                    <button type="button" onClick={() => void revoke(s.id)}>
                      Cerrar esta sesión
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Resource>
    </section>
  );
}
