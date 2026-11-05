import type { ReactElement } from 'react';
import type { Scope } from '../api/client';
import { AuditPage } from '../pages/AuditPage';
import { MembersPage } from '../pages/MembersPage';
import { SessionsPage } from '../pages/SessionsPage';

/**
 * Un módulo del panel. Los equipos 2, 3 y 4 entregan los suyos con esta misma forma: el shell solo
 * decide si se muestra (por scope) y dónde se monta; no conoce su contenido.
 */
export interface ShellModule {
  id: string;
  /** Ruta relativa dentro del shell (sin barra inicial). */
  path: string;
  label: string;
  /** Scope necesario; sin él el módulo no aparece en la navegación y la ruta responde "sin acceso". */
  requiredScope?: Scope;
  element: ReactElement;
}

/** Módulos del Equipo 1. Se añaden los de otros equipos concatenando sus listas. */
export const platformModules: ShellModule[] = [
  {
    id: 'members',
    path: 'miembros',
    label: 'Miembros',
    requiredScope: 'organizations:admin',
    element: <MembersPage />,
  },
  { id: 'sessions', path: 'sesiones', label: 'Mis sesiones', element: <SessionsPage /> },
  {
    id: 'audit',
    path: 'auditoria',
    label: 'Auditoría',
    requiredScope: 'organizations:admin',
    element: <AuditPage />,
  },
];
