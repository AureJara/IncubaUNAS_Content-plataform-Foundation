import { api, type AuditEvent } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, Resource } from '../shell/States';
import { useAsync } from '../shell/useAsync';

export function AuditPage() {
  const { state } = useAuth();
  const organizationId =
    state.status === 'authenticated' ? state.capabilities?.organization_id : undefined;
  const events = useAsync(
    () =>
      api<{ items: AuditEvent[]; next_cursor: string | null }>(
        `/platform/v1/organizations/${organizationId}/audit-events?limit=50`,
      ),
    [organizationId],
  );

  return (
    <section aria-labelledby="auditoria-titulo">
      <h1 id="auditoria-titulo">Auditoría</h1>
      <Resource state={events} onRetry={events.reload}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState>Todavía no hay actividad registrada.</EmptyState>
          ) : (
            <table>
              <caption className="visually-hidden">Eventos de identidad y autorización</caption>
              <thead>
                <tr>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {items.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.occurred_at).toLocaleString('es-PE')}</td>
                    <td>{event.action}</td>
                    <td>{event.outcome}</td>
                    <td>
                      <small>{event.request_id}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </Resource>
    </section>
  );
}
