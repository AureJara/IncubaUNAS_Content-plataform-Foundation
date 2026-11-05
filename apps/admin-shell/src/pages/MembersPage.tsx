import { useState, type FormEvent } from 'react';
import { api, friendlyMessage, type Membership, type Role } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, Resource } from '../shell/States';
import { useAsync } from '../shell/useAsync';

interface MembershipPage {
  items: Membership[];
  next_cursor: string | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  org_owner: 'Owner',
  security_admin: 'Administrador de seguridad',
  site_editor: 'Editor de sitios',
  event_manager: 'Gestor de eventos',
  application_reviewer: 'Revisor de postulaciones',
  checkin_staff: 'Personal de check-in',
  checkin_supervisor: 'Supervisor de check-in',
  report_viewer: 'Consulta de reportes',
};

const STATE_LABELS: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  revoked: 'Revocado',
  invited: 'Invitado',
  expired: 'Vencido',
};

export function MembersPage() {
  const { state } = useAuth();
  const organizationId =
    state.status === 'authenticated' ? state.capabilities?.organization_id : undefined;
  const members = useAsync(
    () => api<MembershipPage>(`/platform/v1/organizations/${organizationId}/memberships`),
    [organizationId],
  );
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function change(member: Membership, patch: Record<string, unknown>, success: string) {
    try {
      await api(`/platform/v1/memberships/${member.id}`, {
        method: 'PATCH',
        body: patch,
        ifMatch: member.revision,
      });
      setMessage({ kind: 'ok', text: success });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyMessage(error) });
    }
    members.reload();
  }

  return (
    <section aria-labelledby="miembros-titulo">
      <h1 id="miembros-titulo">Miembros</h1>
      {/* Región viva: los lectores de pantalla anuncian el resultado de cada acción. */}
      <div aria-live="polite" role="status">
        {message && (
          <p className={message.kind === 'error' ? 'notice notice-error' : 'notice'}>
            {message.text}
          </p>
        )}
      </div>

      <InviteForm
        organizationId={organizationId}
        onDone={(text) => {
          setMessage({ kind: 'ok', text });
          members.reload();
        }}
        onError={(error) => setMessage({ kind: 'error', text: friendlyMessage(error) })}
      />

      <Resource state={members} onRetry={members.reload}>
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState>Aún no hay miembros en esta organización.</EmptyState>
          ) : (
            <table>
              <caption className="visually-hidden">Miembros de la organización</caption>
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((member) => (
                  <tr key={member.id}>
                    <th scope="row">
                      {member.display_name ?? 'Sin nombre'}
                      <br />
                      <small>{member.email}</small>
                    </th>
                    <td>
                      <label>
                        <span className="visually-hidden">
                          Rol de {member.display_name ?? member.email}
                        </span>
                        <select
                          value={member.roles[0]}
                          disabled={member.state === 'revoked'}
                          onChange={(e) =>
                            void change(member, { roles: [e.target.value] }, 'Rol actualizado.')
                          }
                        >
                          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td>{STATE_LABELS[member.state] ?? member.state}</td>
                    <td>
                      {member.state === 'active' && (
                        <button
                          type="button"
                          onClick={() =>
                            void change(member, { state: 'suspended' }, 'Miembro suspendido.')
                          }
                        >
                          Suspender
                        </button>
                      )}
                      {member.state === 'suspended' && (
                        <button
                          type="button"
                          onClick={() =>
                            void change(member, { state: 'active' }, 'Miembro reactivado.')
                          }
                        >
                          Reactivar
                        </button>
                      )}
                      {member.state !== 'revoked' && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            window.confirm(
                              `¿Revocar el acceso de ${member.email ?? 'este miembro'}? No se puede deshacer.`,
                            ) && void change(member, { state: 'revoked' }, 'Acceso revocado.')
                          }
                        >
                          Revocar
                        </button>
                      )}
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

function InviteForm(props: {
  organizationId: string | undefined;
  onDone: (text: string) => void;
  onError: (error: unknown) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('site_editor');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/platform/v1/organizations/${props.organizationId}/invitations`, {
        method: 'POST',
        body: {
          email,
          roles: [role],
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      setEmail('');
      props.onDone('Invitación enviada. Vence en 7 días.');
    } catch (error) {
      props.onError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} aria-labelledby="invitar-titulo">
      <h2 id="invitar-titulo">Invitar a una persona</h2>
      <label>
        Correo
        <input
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Rol
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar invitación'}
      </button>
    </form>
  );
}
