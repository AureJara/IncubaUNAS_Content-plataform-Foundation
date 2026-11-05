// Carga `.env` (ignorado por git) para que las pruebas de integración encuentren la base local.
// En CI las variables ya vienen del entorno; sin `.env` las pruebas de BD se omiten en local.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  /* sin .env */
}
