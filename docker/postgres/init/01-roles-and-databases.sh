#!/bin/sh
# Una base lógica por servicio, con dos roles:
#   <svc>_migrator → dueño del esquema; solo lo usan las migraciones.
#   <svc>_app      → rol de runtime: NOSUPERUSER y NOBYPASSRLS, para que FORCE ROW LEVEL SECURITY
#                    aísle a cada organización incluso ante un bug de aplicación.
set -eu

create_service() {
  svc="$1"
  migrator_password="$2"
  app_password="$3"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE ${svc}_migrator LOGIN PASSWORD '${migrator_password}' NOSUPERUSER NOBYPASSRLS;
CREATE ROLE ${svc}_app LOGIN PASSWORD '${app_password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE DATABASE ${svc} OWNER ${svc}_migrator;
REVOKE ALL ON DATABASE ${svc} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${svc} TO ${svc}_app;
SQL
}

create_service platform "$PLATFORM_DB_MIGRATOR_PASSWORD" "$PLATFORM_DB_APP_PASSWORD"
create_service content "$CONTENT_DB_MIGRATOR_PASSWORD" "$CONTENT_DB_APP_PASSWORD"
