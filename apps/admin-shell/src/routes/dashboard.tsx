// Panel principal: quién está en sesión, en qué organización y qué módulos faltan por montar.
import { Icon } from '@incuba/ui';
import { Link } from 'react-router';
import { PENDING_MODULES, roleLabel } from '../navigation.ts';
import { useSession } from '../session.ts';
import { Callout, Card, PageHeader } from '../shell/page.tsx';

export function Dashboard() {
  const { me, mock } = useSession();
  return (
    <>
      <PageHeader
        title="Panel principal"
        description="Resumen de tu sesión y de los módulos del panel de gestión de la incubadora."
      />
      {mock !== 'real' && (
        <Callout>
          Las APIs del Equipo 1 todavía responden con su mock: los datos de esta pantalla son de prueba y no se guardan.
        </Callout>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Tu sesión">
          <dl className="space-y-3 font-body-sm text-body-sm">
            <Field label="Nombre" value={me.display_name} />
            <Field label="Rol" value={roleLabel(me.roles)} />
            <div>
              <dt className="text-secondary">Permisos</dt>
              <dd>
                <ul className="mt-1 flex flex-wrap gap-2" aria-label="Permisos de la sesión">
                  {me.capabilities.map((capability) => (
                    <li
                      key={capability}
                      className="rounded-full bg-secondary-container px-2 py-0.5 font-label-md text-label-md text-on-secondary-container"
                    >
                      {capability}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </Card>
        <Card title="Organización">
          {me.active_organization ? (
            <dl className="space-y-3 font-body-sm text-body-sm">
              <Field label="Nombre" value={me.active_organization.display_name} />
              <Field label="Identificador" value={me.active_organization.slug} />
            </dl>
          ) : (
            <p className="font-body-sm text-body-sm text-secondary">No tienes una organización activa.</p>
          )}
        </Card>
      </div>
      <Card title="Módulos del panel">
        <ul className="divide-y divide-surface-container-highest">
          {PENDING_MODULES.map((module) => (
            <li key={module.id} className="flex items-center gap-4 py-3">
              <Icon name={module.icon} className="shrink-0 text-2xl text-primary" />
              <div className="min-w-0 flex-1">
                <Link
                  to={`modulos/${module.id}`}
                  className="font-label-lg text-label-lg text-on-surface hover:text-primary"
                >
                  {module.label}
                </Link>
                <p className="font-body-sm text-body-sm text-secondary">{module.summary}</p>
              </div>
              <span className="hidden shrink-0 rounded-full bg-surface-container px-2.5 py-0.5 font-label-md text-label-md text-secondary sm:inline">
                {module.owner}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-secondary">{label}</dt>
      <dd className="font-label-lg text-label-lg text-on-surface">{value}</dd>
    </div>
  );
}
