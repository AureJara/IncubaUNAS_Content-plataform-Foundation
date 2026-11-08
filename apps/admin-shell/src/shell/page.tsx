// Piezas de página del diseño: encabezado, tarjeta de sección y aviso informativo.
import { Icon } from '@incuba/ui';
import type { ReactNode } from 'react';

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header>
      <h1 className="font-headline-lg text-headline-lg-mobile tracking-tight text-on-surface md:text-headline-lg">
        {title}
      </h1>
      {description && <p className="mt-1.5 max-w-3xl font-body-md text-body-md text-secondary">{description}</p>}
    </header>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-surface-container-highest bg-surface-container-lowest p-6 shadow-sm lg:p-8">
      {title && <h2 className="mb-4 font-headline-sm text-headline-sm text-on-surface">{title}</h2>}
      {children}
    </section>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl border border-secondary-container bg-secondary-container/40 p-4">
      <Icon name="info" className="mt-0.5 shrink-0 text-xl text-primary" />
      <div className="font-body-sm text-body-sm text-on-surface">{children}</div>
    </div>
  );
}
