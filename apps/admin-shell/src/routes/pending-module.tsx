// Módulo que todavía no está montado en el shell. Dice de quién es y qué falta; no muestra datos inventados.
import { Icon } from '@incuba/ui';
import { data, Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { findPendingModule } from '../navigation.ts';
import { Callout, Card, PageHeader } from '../shell/page.tsx';

export function pendingModuleLoader({ params }: LoaderFunctionArgs) {
  const module = findPendingModule(params['moduleId']);
  if (!module) throw data(null, { status: 404 });
  return module;
}

export function PendingModule() {
  const module = useLoaderData<typeof pendingModuleLoader>();
  return (
    <>
      <PageHeader title={module.label} description={module.summary} />
      <Card>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <Icon name="construction" className="text-2xl" />
          </span>
          <div className="space-y-2">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Módulo aún no montado</h2>
            <p className="font-body-md text-body-md text-secondary">
              Lo desarrolla <strong className="text-on-surface">{module.owner}</strong>. Aparecerá aquí cuando se monte
              en el shell con su contrato de integración.
            </p>
            <Link
              to=".."
              relative="path"
              className="inline-flex items-center gap-1.5 font-label-lg text-label-lg text-primary hover:underline"
            >
              Volver al panel principal
              <Icon name="arrow_forward" className="text-base" />
            </Link>
          </div>
        </div>
      </Card>
      <Callout>El menú ya muestra este módulo para que la navegación del panel quede completa desde el inicio.</Callout>
    </>
  );
}
