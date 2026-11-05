/**
 * Segmentos de la URL que son secretos: el token de una invitación o de una vista previa viaja en la
 * ruta (así lo fija el catálogo), y el `code` del callback OIDC en la query. Ninguno debe llegar a los logs.
 */
const SECRET_PATH_SEGMENTS = [/(\/invitations\/)[^/?#]+/g, /(\/previews\/)[^/?#]+/g];
const SECRET_QUERY_PARAMS = /([?&](?:code|state|session_state)=)[^&#]*/g;

export function redactUrl(url: string): string {
  const path = SECRET_PATH_SEGMENTS.reduce(
    (current, pattern) => current.replace(pattern, '$1[redacted]'),
    url,
  );
  return path.replace(SECRET_QUERY_PARAMS, '$1[redacted]');
}
