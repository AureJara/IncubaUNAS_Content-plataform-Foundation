import { isUuid, notFound, type Uuid } from '@incubaunas/shared-kernel';

/** El token de vista previa lleva la organización delante: así se fija el tenant antes de buscarlo. */
export function parseDraftToken(token: string): { organizationId: Uuid; secret: string } {
  const separator = token.indexOf('.');
  const organizationId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (separator < 0 || !isUuid(organizationId) || secret.length < 20)
    throw notFound('La vista previa');
  return { organizationId, secret };
}
