// Emite un token de máquina de corta vida para DESARROLLO LOCAL (p. ej. dar de alta la primera
// organización). En producción los tokens los emite el proveedor de identidad, no este script.
//
//   pnpm --filter @incubaunas/platform-api mint-token --scope platform:admin
import { SignJWT } from 'jose';

const args = process.argv.slice(2);
const option = (name: string, fallback?: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const secret = process.env.INTERNAL_JWT_SECRET;
if (!secret) {
  console.error('Falta INTERNAL_JWT_SECRET en el entorno.');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const organizationId = option('organization');
const token = await new SignJWT({
  scopes: (option('scope', 'platform:admin') ?? '').split(','),
  roles: (option('role') ?? '').split(',').filter(Boolean),
  amr: ['pwd', 'mfa'],
  ...(organizationId ? { organization_id: organizationId } : {}),
})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(option('subject', 'service:dev-bootstrap')!)
  .setIssuer(process.env.INTERNAL_JWT_ISSUER ?? 'https://platform.incubaunas.local')
  .setAudience(process.env.INTERNAL_JWT_AUDIENCE ?? 'platform-api')
  .setIssuedAt(now)
  .setExpirationTime(now + 15 * 60)
  .sign(new TextEncoder().encode(secret));

console.log(token);
