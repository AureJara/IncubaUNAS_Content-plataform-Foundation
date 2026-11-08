// Menú del shell (spec 4.1). Solo "Panel principal" y "Sitios web" son del Equipo 1 y ya tienen pantalla; los demás
// módulos son de otros equipos o de fases siguientes y se montan con el contrato de integración de C-08. Mientras
// tanto el ítem existe y abre una pantalla que dice de quién es y qué falta, sin datos inventados.
import type { IconName } from '@incuba/ui';
import type { PlatformComponents } from '@incuba/api-client';
import type { Scope } from './session.ts';

type Role = PlatformComponents['schemas']['Role'];

export interface PendingModule {
  id: string;
  label: string;
  icon: IconName;
  owner: string;
  summary: string;
}

export interface NavItem {
  label: string;
  icon: IconName;
  /** Ruta relativa a `/o/{orgSlug}`; vacía para el panel. */
  to: string;
  /** El ítem se oculta sin esta capability (FE-06). */
  capability?: Scope;
}

export const PENDING_MODULES: readonly PendingModule[] = [
  {
    id: 'convocatorias',
    label: 'Mis convocatorias',
    icon: 'event',
    owner: 'Equipo 2 · Eventos',
    summary: 'Listado de convocatorias y eventos de la organización.',
  },
  {
    id: 'crear-convocatoria',
    label: 'Crear convocatoria',
    icon: 'add_circle',
    owner: 'Equipo 2 · Eventos',
    summary: 'Formulario para publicar una convocatoria nueva.',
  },
  {
    id: 'postulantes',
    label: 'Postulantes',
    icon: 'how_to_reg',
    owner: 'Equipo 3 · Inscripciones',
    summary: 'Revisión de postulaciones y estados de cada postulante.',
  },
  {
    id: 'equipo',
    label: 'Equipo & mentores',
    icon: 'group',
    owner: 'Equipo 1 · Fase 3',
    summary: 'Miembros, invitaciones y roles de la organización.',
  },
  {
    id: 'participaciones',
    label: 'Participaciones',
    icon: 'trophy',
    owner: 'Equipo 3 · Inscripciones',
    summary: 'Participaciones confirmadas y su historial.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: 'settings',
    owner: 'Equipo 1 · Fases 3 y 4',
    summary: 'Datos de la organización, dominios y seguridad.',
  },
];

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Panel principal', icon: 'dashboard', to: '' },
  { label: 'Sitios web', icon: 'language', to: 'sitios', capability: 'sites:write' },
  ...PENDING_MODULES.map((module) => ({ label: module.label, icon: module.icon, to: `modulos/${module.id}` })),
];

export function visibleNavItems(capabilities: readonly Scope[]): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.capability || capabilities.includes(item.capability));
}

export function findPendingModule(id: string | undefined): PendingModule | undefined {
  return PENDING_MODULES.find((module) => module.id === id);
}

const ROLE_LABELS: Record<Role, string> = {
  org_owner: 'Titular de la organización',
  security_admin: 'Administración de seguridad',
  site_editor: 'Edición de sitios',
  event_manager: 'Gestión de eventos',
  application_reviewer: 'Revisión de postulaciones',
  checkin_staff: 'Control de acceso',
  checkin_supervisor: 'Supervisión de acceso',
  report_viewer: 'Consulta de reportes',
};

export function roleLabel(roles: readonly Role[]): string {
  const [first] = roles;
  return first ? ROLE_LABELS[first] : 'Sin rol asignado';
}

/** Iniciales para el avatar: las dos primeras palabras del nombre. */
export function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es'))
    .join('');
}
